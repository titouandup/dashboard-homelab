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
