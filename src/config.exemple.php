<?php

// IP locale de chaque machine (à compléter)
$ip = [
    'proxmox'   => '192.168.1.XX',  // hôte pve
    'jellyfin'  => '192.168.1.XX',  // LXC 100
    'adguard'   => '192.168.1.XX',  // LXC 101
    'docker'    => '192.168.1.XX',  // LXC 102
    'immich'    => '192.168.1.XX',  // LXC 104
    'homeassistant' => '192.168.1.XX',  // VM 105
];

return [
    ['nom' => 'Jellyfin',       'desc' => 'Streaming média',  'url' => "http://{$ip['jellyfin']}:8096"],
    ['nom' => 'AdGuard Home',   'desc' => 'DNS filtrant',     'url' => "http://{$ip['adguard']}"],
    ['nom' => 'Immich',         'desc' => 'Galerie photos',   'url' => "http://{$ip['immich']}:2283"],
    ['nom' => 'Vaultwarden',    'desc' => 'Mots de passe',    'url' => "http://{$ip['docker']}:8222"],
    ['nom' => 'Home Assistant', 'desc' => 'Domotique',        'url' => "http://{$ip['homeassistant']}"],
    ['nom' => 'Proxmox',        'desc' => 'Hyperviseur',      'url' => "https://{$ip['proxmox']}:8006"],
];