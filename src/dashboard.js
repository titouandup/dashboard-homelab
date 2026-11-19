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

// Récupère l'historique des 24 dernières heures à l'adresse donnée.
// Renvoie null au moindre problème ou s'il est vide : le graphique reste alors caché.
async function chargerHistorique(url) {
    try {
        const reponse = await fetch(url);
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

// Un graphique par bloc de la page : d'où viennent les mesures, où les dessiner, quelles courbes.
// variable : nom de la variable CSS de la couleur (le canvas ne lit pas le CSS, voir couleur()).
// axe : min / max figent l'axe Y ; suggestedMin / suggestedMax donnent une plage minimale qui s'élargit si besoin.
const GRAPHIQUES = [
    {
        url: 'historique.php', bloc: 'historique', canvas: 'graphique', unite: '%',
        axe: { min: 0, max: 100 },
        courbes: [
            { cle: 'cpu',    nom: 'CPU',    variable: '--accent', tirets: [] },
            { cle: 'ram',    nom: 'RAM',    variable: '--text',   tirets: [] },
            { cle: 'disque', nom: 'Disque', variable: '--muted',  tirets: [6, 4] },
        ],
    },
    {
        url: 'historique-salon.php', bloc: 'historique-temperature', canvas: 'graphique-temperature', unite: '°C',
        axe: { suggestedMin: 15, suggestedMax: 30 },
        courbes: [{ cle: 'temperature', nom: 'Température', variable: '--accent', tirets: [] }],
    },
    {
        url: 'historique-salon.php', bloc: 'historique-humidite', canvas: 'graphique-humidite', unite: '%',
        axe: { suggestedMin: 20, suggestedMax: 80 },
        courbes: [{ cle: 'humidite', nom: 'Humidité', variable: '--text', tirets: [] }],
    },
];

// Lit une couleur du thème actuel : Chart.js dessine dans un canvas et ne comprend pas les variables CSS.
function couleur(nom) {
    return getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
}

// Timestamp Unix (en secondes) -> « 14:30 ».
function formaterHeure(timestamp) {
    return new Date(timestamp * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// Dessine (ou redessine) un graphique des 24 dernières heures, décrit par un élément de GRAPHIQUES.
function dessinerHistorique(mesures, g) {
    Chart.getChart(g.canvas)?.destroy();   // sinon Chart.js refuse un 2e graphique sur le même canvas
    const texte = couleur('--text');
    const discret = couleur('--muted');
    const fin = Math.ceil(Date.now() / 3600000) * 3600;   // prochaine heure pleine : les repères de l'axe tombent sur des heures rondes
    const avecUnite = (v) => v.toLocaleString('fr-FR') + ' ' + g.unite;

    // Axe X = le temps réel : une panne laisse un vrai trou, car spanGaps coupe la courbe dès 3 mesures manquantes.
    // typeof : un capteur hors ligne écrit null, ce point est simplement absent de sa courbe.
    const courbe = ({ cle, nom, variable, tirets }) => ({
        label: nom,
        data: mesures.filter((m) => typeof m[cle] === 'number').map((m) => ({ x: m.heure, y: m[cle] })),
        borderColor: couleur(variable),
        borderDash: tirets,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        spanGaps: 3 * PERIODE_CRON,
    });

    new Chart(document.getElementById(g.canvas), {
        type: 'line',
        data: { datasets: g.courbes.map(courbe) },
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
                y: { ...g.axe, grid: { color: couleur('--line') }, ticks: { color: discret, callback: avecUnite } },
            },
            plugins: {
                legend: { display: g.courbes.length > 1, position: 'top', labels: { color: texte } },
                tooltip: {
                    callbacks: {
                        title: (elements) => formaterHeure(elements[0].parsed.x),
                        label: (c) => c.dataset.label + ' : ' + avecUnite(c.parsed.y),
                    },
                },
            },
        },
    });
}

const aRedessiner = [];   // une fonction par graphique affiché

// Au chargement : récupère l'historique, affiche le bloc et dessine le graphique.
async function afficherHistorique(g) {
    const mesures = await chargerHistorique(g.url);
    if (!mesures || typeof Chart === 'undefined') {
        return;   // pas de données, erreur ou Chart.js absent : le bloc reste caché
    }
    document.getElementById(g.bloc).hidden = false;   // avant de dessiner : un canvas caché a une taille nulle
    dessinerHistorique(mesures, g);
    aRedessiner.push(() => dessinerHistorique(mesures, g));
}

// Au clic sur le bouton de thème : redessine tout, car le canvas ne suit pas le CSS.
document.addEventListener('click', (e) => {
    if (e.target.closest('#theme')) {
        aRedessiner.forEach((redessiner) => redessiner());
    }
});

GRAPHIQUES.forEach(afficherHistorique);
setInterval(rafraichir, 30000);
