<?php
date_default_timezone_set('Europe/Paris');

// Teste tous les services EN PARALLÈLE (sinon 6 services x 2 s = 12 s d'attente)
function verifierServices(array $services): array
{
    $multi = curl_multi_init();
    $requetes = [];
    
    foreach ($services as $i => $s) {
        $ch = curl_init($s['url']);
        curl_setopt_array($ch, [
            CURLOPT_NOBODY         => true,   // on veut juste savoir si ça répond, pas le contenu
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 2,
            CURLOPT_SSL_VERIFYPEER => false,  // certificats auto-signés en local (Proxmox)
            CURLOPT_SSL_VERIFYHOST => false,
        ]);
        curl_multi_add_handle($multi, $ch);
        $requetes[$i] = $ch;
    }

    do {
        curl_multi_exec($multi, $enCours);
        curl_multi_select($multi);
    } while ($enCours > 0);

    $resultats = [];
    foreach ($requetes as $i => $ch) {
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        // Toute réponse HTTP (même 401, 404 ou 501) prouve que le service tourne.
        // Proxmox, par exemple, répond 501 aux requêtes HEAD : il est pourtant bien en ligne.
        $resultats[$i] = $code > 0;
        curl_multi_remove_handle($multi, $ch);
        curl_close($ch);
    }
    curl_multi_close($multi);

    return $resultats;
}

// Appelle une API JSON en GET avec un en-tête Authorization.
// Renvoie le JSON décodé, ou null au moindre échec (réseau, code HTTP différent de 200, JSON invalide).
// $autoSigne : accepte un certificat HTTPS auto-signé (cas de Proxmox en local).
// Ne jamais ajouter CURLOPT_FOLLOWLOCATION : le token pourrait partir vers un autre hôte.
function appelerApi(string $url, string $autorisation, bool $autoSigne = false): ?array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 3,
        CURLOPT_SSL_VERIFYPEER => !$autoSigne,
        CURLOPT_SSL_VERIFYHOST => $autoSigne ? 0 : 2,
        CURLOPT_HTTPHEADER     => ['Authorization: ' . $autorisation],
    ]);
    $reponse = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($reponse === false || $code !== 200) {
        return null;
    }
    $data = json_decode($reponse, true);
    return is_array($data) ? $data : null;
}

// Lit le CPU, la RAM et le disque du serveur via l'API Proxmox (token en lecture seule, voir .env).
// Renvoie null au moindre échec : la page n'affiche alors rien, sans détail technique.
function lireStatutProxmox(): ?array
{
    $url = getenv('PROXMOX_URL') . '/api2/json/nodes/' . getenv('PROXMOX_NODE') . '/status';
    $jeton = 'PVEAPIToken=' . getenv('PROXMOX_TOKEN_ID') . '=' . getenv('PROXMOX_TOKEN_SECRET');

    // true : certificat auto-signé de Proxmox
    $data = appelerApi($url, $jeton, true)['data'] ?? null;
    // Réponse incomplète, non numérique ou totaux à 0 : on renvoie null plutôt que de planter la page
    $valeurs = [$data['cpu'] ?? null, $data['memory']['used'] ?? null, $data['memory']['total'] ?? null,
                $data['rootfs']['used'] ?? null, $data['rootfs']['total'] ?? null];
    if (count(array_filter($valeurs, 'is_numeric')) < 5 || $valeurs[2] <= 0 || $valeurs[4] <= 0) {
        return null;
    }

    return [
        'cpu'    => round($data['cpu'] * 100),
        'ram'    => round($data['memory']['used'] / $data['memory']['total'] * 100),
        'disque' => round($data['rootfs']['used'] / $data['rootfs']['total'] * 100),
    ];
}

// Réutilise le dernier résultat pendant $duree secondes au lieu de le recalculer.
// $calcul renvoie null en cas d'échec. L'échec est mis en cache aussi (écrit false dans le fichier) :
// sinon, pendant une panne, chaque visiteur relancerait l'appel et attendrait le timeout.
function enCache(string $nom, int $duree, callable $calcul): mixed
{
    $fichier = sys_get_temp_dir() . '/dashboard-' . $nom . '.json';

    if (is_file($fichier) && time() - filemtime($fichier) < $duree) {
        $contenu = json_decode(file_get_contents($fichier), true);
        if ($contenu !== null) {   // null = fichier vide ou corrompu : on recalcule
            return $contenu === false ? null : $contenu;
        }
    }

    $resultat = $calcul();
    // Fichier temporaire puis rename() : atomique, un lecteur ne voit jamais un fichier à moitié écrit
    $temporaire = tempnam(sys_get_temp_dir(), 'dashboard-');
    file_put_contents($temporaire, json_encode($resultat ?? false));
    rename($temporaire, $fichier);
    return $resultat;
}

// Rassemble tout ce que la page et le JSON affichent : un seul endroit, donc jamais d'écart entre les deux.
function etatDuDashboard(array $services): array
{
    return [
        'services' => enCache('services', 30, fn() => verifierServices($services)),
        'serveur'  => enCache('proxmox', 30, 'lireStatutProxmox'),
        'heure'    => date('H:i:s'),
    ];
}

const BASE_HISTORIQUE = '/data/historique.sqlite';

function ouvrirBase(): PDO
{
    $base = new PDO('sqlite:' . BASE_HISTORIQUE);
    $base->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $base->exec('CREATE TABLE IF NOT EXISTS mesures (
        heure INTEGER PRIMARY KEY, -- timestamp Unix
        cpu REAL,
        ram REAL,
        disque REAL
    )');
    return $base;
}

// Enregistre une mesure et supprime celles de plus de 7 jours.
// Sans mesure (Proxmox hors ligne) : rien n'est écrit, le graphique aura un trou.
function enregistrerMesure(PDO $base, ?array $mesure): void
{
    if ($mesure === null) {
        return;
    }
    $maintenant = time();
    $base->prepare('INSERT OR REPLACE INTO mesures (heure, cpu, ram, disque) VALUES (?, ?, ?, ?)')
         ->execute([$maintenant, $mesure['cpu'], $mesure['ram'], $mesure['disque']]);
    $base->prepare('DELETE FROM mesures WHERE heure < ?')
         ->execute([$maintenant - 7 * 86400]);
}

// Renvoie les mesures des dernières 24 h, de la plus ancienne à la plus récente.
function lireHistorique(PDO $base): array
{
    $requete = $base->prepare('SELECT heure, cpu, ram, disque FROM mesures WHERE heure >= ? ORDER BY heure');
    $requete->execute([time() - 86400]);
    return $requete->fetchAll(PDO::FETCH_ASSOC);
}
