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

// Applique l'état reçu de l'API à toute la page.
// La forme de etat est vérifiée une seule fois, dans rafraichir() : pas de contrôle ici.
function mettreAJourPage(etat) {
    mettreAJourServices(etat.services);
    mettreAJourServeur(etat.serveur);

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

setInterval(rafraichir, 30000);
