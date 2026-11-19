// Met à jour chaque carte : la classe ok/ko (le CSS gère les couleurs) et le texte de la pastille.
function mettreAJourServices(services) {
    const cartes = document.querySelectorAll('.carte');
    if (cartes.length !== services.length) {
        return;   // config.php a changé depuis l'affichage : on ne décale pas les cartes
    }
    services.forEach((enLigne, i) => {
        cartes[i].classList.toggle('ok', enLigne);
        cartes[i].classList.toggle('ko', !enLigne);
        cartes[i].querySelector('.statut').textContent = enLigne ? 'En ligne' : 'Hors ligne';
    });
}

// Met à jour le bloc « Serveur » : visible s'il y a des données, caché sinon.
function mettreAJourServeur(serveur) {
    document.getElementById('serveur').hidden = !serveur;
    if (!serveur) {
        return;   // bloc caché : on ne touche pas aux valeurs
    }
    // On parcourt les mesures présentes dans la page : le HTML reste la seule source de vérité
    for (const ligne of document.querySelectorAll('[data-mesure]')) {
        const valeur = Number(serveur[ligne.dataset.mesure]);
        if (!Number.isFinite(valeur)) {
            continue;   // mesure absente ou invalide : on garde l'affichage actuel
        }
        ligne.querySelector('strong').textContent = valeur + ' %';
        ligne.querySelector('.barre div').style.width = valeur + '%';
    }
}

// Même format que index.php : virgule décimale, une décimale, puis l'unité.
function formaterValeur(valeur, unite) {
    return valeur.toFixed(1).replace('.', ',') + ' ' + unite;
}

// Met à jour les sections du salon : chacune est cachée si son capteur ne répond pas (null).
// typeof et non !valeur : 0 est une vraie mesure. Et un non-nombre ferait planter toFixed(),
// ce qui laisserait la page à moitié rafraîchie (le résumé et l'heure sont mis à jour après).
function mettreAJourSalon(etat) {
    for (const section of document.querySelectorAll('[data-salon]')) {
        const valeur = etat[section.dataset.salon];
        section.hidden = typeof valeur !== 'number';
        if (!section.hidden) {
            section.querySelector('.valeur').textContent = formaterValeur(valeur, section.dataset.unite);
        }
    }
}

// Applique l'état reçu de l'API à toute la page.
// La forme de etat est vérifiée une seule fois, dans rafraichir() : pas de contrôle ici.
function mettreAJourPage(etat) {
    mettreAJourServices(etat.services);
    mettreAJourServeur(etat.serveur);
    mettreAJourSalon(etat);

    const nbEnLigne = etat.services.filter(Boolean).length;
    document.getElementById('resume').textContent = nbEnLigne + ' / ' + etat.services.length;
    document.getElementById('heure').textContent = etat.heure;
}

// Redemande l'état à l'API. En cas de problème, la page garde ses dernières valeurs.
async function rafraichir() {
    try {
        const reponse = await fetch('api.php');
        if (!reponse.ok) {
            return;
        }
        const etat = await reponse.json();
        if (!Array.isArray(etat?.services)) {
            return;
        }
        mettreAJourPage(etat);
    } catch (erreur) {
        console.error(erreur);   // réseau coupé ou JSON invalide : rien d'affiché dans la page
    }
}

// Récupère l'historique des 24 dernières heures.
// Renvoie null au moindre problème ou s'il est vide : le graphique reste alors caché.
async function chargerHistorique() {
    try {
        const reponse = await fetch('historique.php');
        if (!reponse.ok) {
            return null;
        }
        const mesures = await reponse.json();
        return Array.isArray(mesures) && mesures.length > 0 ? mesures : null;
    } catch (erreur) {
        console.error(erreur);
        return null;
    }
}

const PERIODE_CRON = 5 * 60;   // secondes entre deux mesures : à garder identique à la ligne du cron

// Lit une couleur du thème actuel : Chart.js dessine dans un canvas et ne comprend pas les variables CSS.
function couleur(nom) {
    return getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
}

// Timestamp Unix (en secondes) -> « 14:30 ».
function formaterHeure(timestamp) {
    return new Date(timestamp * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// Dessine (ou redessine) le graphique des 24 dernières heures.
function dessinerHistorique(mesures) {
    Chart.getChart('graphique')?.destroy();   // sinon Chart.js refuse un 2e graphique sur le même canvas
    const texte = couleur('--text');
    const discret = couleur('--muted');
    const fin = Math.ceil(Date.now() / 3600000) * 3600;   // prochaine heure pleine : les repères de l'axe tombent sur des heures rondes

    // Axe X = le temps réel : une panne de Proxmox laisse un vrai trou, car spanGaps coupe la courbe dès 3 mesures manquantes
    const courbe = (cle, nom, trait, tirets) => ({
        label: nom,
        data: mesures.map((m) => ({ x: m.heure, y: m[cle] })),
        borderColor: trait,
        borderDash: tirets,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        spanGaps: 3 * PERIODE_CRON,
    });

    new Chart(document.getElementById('graphique'), {
        type: 'line',
        data: {
            datasets: [
                courbe('cpu', 'CPU', couleur('--accent'), []),
                courbe('ram', 'RAM', texte, []),
                courbe('disque', 'Disque', discret, [6, 4]),
            ],
        },
        options: {
            animation: false,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    type: 'linear',
                    min: fin - 86400,
                    max: fin,
                    grid: { display: false },
                    ticks: { color: discret, stepSize: 4 * 3600, maxRotation: 0, callback: formaterHeure },
                },
                y: { min: 0, max: 100, grid: { color: couleur('--line') }, ticks: { color: discret, callback: (v) => v + ' %' } },
            },
            plugins: {
                legend: { position: 'top', labels: { color: texte } },
                tooltip: {
                    callbacks: {
                        title: (elements) => formaterHeure(elements[0].parsed.x),
                        label: (c) => c.dataset.label + ' : ' + c.parsed.y + ' %',
                    },
                },
            },
        },
    });
}

// Au chargement : récupère l'historique, affiche le bloc et dessine le graphique.
// Au clic sur le bouton de thème : redessine, car le canvas ne suit pas le CSS.
async function afficherHistorique() {
    const mesures = await chargerHistorique();
    if (!mesures || typeof Chart === 'undefined') {
        return;   // pas de données, erreur ou Chart.js absent : le bloc reste caché
    }
    document.getElementById('historique').hidden = false;
    dessinerHistorique(mesures);
    document.addEventListener('click', (e) => {
        if (e.target.closest('#theme')) {
            dessinerHistorique(mesures);
        }
    });
}

afficherHistorique();
setInterval(rafraichir, 30000);
