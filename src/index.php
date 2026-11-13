<?php
date_default_timezone_set('Europe/Paris');
 
$services = require __DIR__ . '/config.php';
 
// Teste tous les services EN PARALLÈLE (sinon 6 services x 2 s = 12 s d'attente)
function verifierServices(array $services): array
{
    $multi = curl_multi_init();
    $requetes = [];
    // Prépare une requête cURL par service et l'ajoute au lot parallèle
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
    // Récupère le code HTTP de chaque requête, puis libère les handles
    foreach ($requetes as $i => $ch) {
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        // Réponse HTTP => le service tourne
        $resultats[$i] = $code > 0 && $code < 500;
        curl_multi_remove_handle($multi, $ch);
        curl_close($ch);
    }
    curl_multi_close($multi);
 
    return $resultats;
}
 
$enLigne = verifierServices($services);
$nbEnLigne = count(array_filter($enLigne));
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header>
        <h1>Homelab<span>.</span></h1>
        <p class="resume"><?= $nbEnLigne ?> / <?= count($services) ?> services en ligne</p>
        <p class="maj">Vérifié à <?= date('H:i:s') ?></p>
    </header>

    <main classe="grille">
        <article class="carte x">
            <div>
                <h2>nom</h2>
                <h2>Description</h2>
            </div>
            <span class="statut">En ligne/Hors Ligne</span>
        </article>
    </main>

    <footer>
        <a href="https://github.com/titouandup/dashboard-homelab">Code source</a>
    </footer>
</body>
</html>
