<?php
// En-têtes en premier : même en cas d'erreur plus bas, la réponse est annoncée comme du JSON.
header('Content-Type: application/json');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

require __DIR__ . '/fonctions.php';

try {
    echo json_encode(lireHistoriqueSalon(ouvrirBase()));
} catch (PDOException) {
    http_response_code(500);   // pas de détail : le message d'erreur contient le chemin de la base
    echo '[]';
}
