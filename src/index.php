<?php
date_default_timezone_set('Europe/Paris');
 
$services = require __DIR__ . '/config.php';
 
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
    <script>
        // Thème : choix mémorisé, sinon réglage du système. Posé dans le <head> pour éviter le flash.
        const theme = localStorage.getItem('theme')
            || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        document.documentElement.dataset.theme = theme;

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#theme')) return;
            const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
            document.documentElement.dataset.theme = next;
            localStorage.setItem('theme', next);
        });
    </script>
</head>
<body>
    <header>
        <h1>Homelab<span>.</span></h1>
        <p class="resume"><?= $nbEnLigne ?> / <?= count($services) ?> services en ligne</p>
        <p class="maj">Vérifié à <?= date('H:i:s') ?></p>
        <button id="theme" class="bouton" type="button" aria-label="Changer de thème"></button>
    </header>

    <main class="grille">
        <?php foreach ($services as $i => $s): ?>
            <article class="carte <?= $enLigne[$i] ? 'ok' : 'ko' ?>">
                <div>
                    <h2><?= htmlspecialchars($s['nom']) ?></h2>
                    <p><?= htmlspecialchars($s['desc']) ?></p>
                </div>
                <span class="statut"><?= $enLigne[$i] ? 'En ligne' : 'Hors ligne' ?></span>
            </article>
        <?php endforeach; ?>
    </main>

    <footer>
        <a href="https://github.com/titouandup/dashboard-homelab">Code source</a>
    </footer>
</body>
</html>
