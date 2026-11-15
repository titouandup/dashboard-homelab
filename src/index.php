<?php
require __DIR__ . '/fonctions.php';

$services = require __DIR__ . '/config.php';
$etat = etatDuDashboard($services);

$enLigne = $etat['services'];
$serveur = $etat['serveur'];
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
        <p class="resume"><strong id="resume"><?= $nbEnLigne ?> / <?= count($services) ?></strong> services en ligne</p>
        <p class="maj">Mis à jour à <span id="heure"><?= $etat['heure'] ?></span></p>
        <button id="theme" class="bouton" type="button" aria-label="Changer de thème"></button>
    </header>

    <section class="serveur" id="serveur" <?= $serveur ? '' : 'hidden' ?>>
        <h2>Serveur</h2>
        <div class="mesures">
            <?php foreach (['cpu' => 'CPU', 'ram' => 'RAM', 'disque' => 'Disque'] as $cle => $nom): ?>
                <?php $valeur = (int) ($serveur[$cle] ?? 0); ?>
                <div data-mesure="<?= $cle ?>">
                    <span class="mesure-nom"><?= $nom ?></span>
                    <strong><?= $valeur ?> %</strong>
                    <div class="barre"><div style="width: <?= $valeur ?>%"></div></div>
                </div>
            <?php endforeach; ?>
        </div>
    </section>

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
