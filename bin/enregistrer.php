<?php
// Lancé par cron : enregistre une mesure du serveur. Jamais appelé depuis le web.
if (PHP_SAPI !== 'cli') {
    exit;
}
require '/var/www/html/fonctions.php';
enregistrerMesure(ouvrirBase(), lireStatutProxmox());
