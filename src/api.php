<?php
// En-têtes en premier : même en cas d'erreur plus bas, la réponse est annoncée comme du JSON.
header('Content-Type: application/json');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

require __DIR__ . '/fonctions.php';

$services = require __DIR__ . '/config.php';
$etat = etatDuDashboard($services);

// Liste blanche : on renvoie champ par champ, pour qu'un ajout futur dans $etat ne fuite pas tout seul.
echo json_encode([
    'services' => array_values($etat['services']),
    'serveur'  => $etat['serveur'],
    'heure'    => $etat['heure'],
]);
