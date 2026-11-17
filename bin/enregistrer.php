<?php
// Lancé par cron : enregistre une mesure du serveur et une du salon. Jamais appelé depuis le web.
if (PHP_SAPI !== 'cli') {
    exit;
}
require '/var/www/html/fonctions.php';

// Appels réseau d'abord, écriture ensuite : la base n'est pas ouverte pendant l'attente.
$proxmox = lireStatutProxmox();
$temperature = lireCapteur(getenv('HA_ENTITE_TEMPERATURE'));
$humidite = lireCapteur(getenv('HA_ENTITE_HUMIDITE'));

$base = ouvrirBase();
enregistrerMesure($base, $proxmox);
enregistrerSalon($base, $temperature, $humidite);
