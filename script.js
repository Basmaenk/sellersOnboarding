"use strict";

// Cette copie permet à la page de fonctionner même avec un double-clic sur index.html.
// Depuis un serveur local, les mêmes données sont chargées depuis data/sellers.csv.
const FALLBACK_SELLERS = [
  {
    entreprise: "Atelier Céleste",
    responsable: "Léa Martin",
    email: "lea.martin@atelier-celeste.example",
    telephone: "06 12 34 56 78",
    assignee: "",
    statut: "À attribuer",
    dateArrivee: "28/07/2026",
    note: "Compte à créer",
  },
  {
    entreprise: "Maison Rivage",
    responsable: "Thomas Bernard",
    email: "thomas.bernard@maison-rivage.example",
    telephone: "06 23 45 67 89",
    assignee: "Camille Dupont",
    statut: "En cours",
    dateArrivee: "25/07/2026",
    note: "Documents à vérifier",
  },
  {
    entreprise: "Studio Mistral",
    responsable: "Inès Robert",
    email: "ines.robert@studio-mistral.example",
    telephone: "06 34 56 78 90",
    assignee: "Malik Benali",
    statut: "Bloqué",
    dateArrivee: "22/07/2026",
    note: "TVA manquante",
  },
  {
    entreprise: "L’Atelier Vert",
    responsable: "Hugo Petit",
    email: "hugo.petit@atelier-vert.example",
    telephone: "06 45 67 89 01",
    assignee: "",
    statut: "À attribuer",
    dateArrivee: "30/07/2026",
    note: "Coordonnées bancaires à recevoir",
  },
  {
    entreprise: "Éclat & Co",
    responsable: "Sarah Moreau",
    email: "sarah.moreau@eclat-co.example",
    telephone: "06 56 78 90 12",
    assignee: "Camille Dupont",
    statut: "En cours",
    dateArrivee: "30/07/2026",
    note: "Catalogue à valider",
  },
];

const CURRENT_USER = "Camille Dupont";
let sellers = [];
let notificationTimer;

const elements = {
  unassignedList: document.querySelector("#unassigned-list"),
  myCasesList: document.querySelector("#my-cases-list"),
  totalCount: document.querySelector("#total-count"),
  progressCount: document.querySelector("#progress-count"),
  unassignedCount: document.querySelector("#unassigned-count"),
  unassignedBadge: document.querySelector("#unassigned-badge"),
  statusFilter: document.querySelector("#status-filter"),
  tableBody: document.querySelector("#sellers-table-body"),
  tableSummary: document.querySelector("#table-summary"),
  notification: document.querySelector("#notification"),
};

function escapeHtml(value) {
  const characterMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };

  return String(value ?? "").replace(/[&<>"']/g, (character) => characterMap[character]);
}

function parseCsvLine(line) {
  const values = [];
  let currentValue = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && insideQuotes && nextCharacter === '"') {
      currentValue += '"';
      index += 1;
    } else if (character === '"') {
      insideQuotes = !insideQuotes;
    } else if (character === "," && !insideQuotes) {
      values.push(currentValue.trim());
      currentValue = "";
    } else {
      currentValue += character;
    }
  }

  values.push(currentValue.trim());
  return values;
}

function parseCsv(csvText) {
  const lines = csvText.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift());

  return lines.filter(Boolean).map((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));

    return {
      entreprise: row.entreprise,
      responsable: row.responsable,
      email: row.email,
      telephone: row.telephone,
      assignee: row.assignee,
      statut: row.statut,
      dateArrivee: row.date_arrivee,
      note: row.note,
    };
  });
}

async function loadSellers() {
  try {
    const response = await fetch("data/sellers.csv", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Le CSV n’a pas pu être chargé (${response.status}).`);
    }

    const csvSellers = parseCsv(await response.text());

    if (csvSellers.length !== FALLBACK_SELLERS.length) {
      throw new Error("Le nombre de vendeurs du CSV est inattendu.");
    }

    return csvSellers;
  } catch (error) {
    // C’est le comportement normal avec une URL qui commence par file://.
    console.info("Données de secours utilisées :", error.message);
    return FALLBACK_SELLERS.map((seller) => ({ ...seller }));
  }
}

function renderUnassignedCards() {
  const unassignedSellers = sellers.filter((seller) => !seller.assignee);
  elements.unassignedBadge.textContent = unassignedSellers.length;

  if (unassignedSellers.length === 0) {
    elements.unassignedList.innerHTML = '<p class="empty-state">Bravo, tous les vendeurs ont été attribués.</p>';
    return;
  }

  elements.unassignedList.innerHTML = unassignedSellers.map((seller) => `
    <article class="seller-card">
      <div>
        <h3>${escapeHtml(seller.entreprise)}</h3>
        <p>Contact : ${escapeHtml(seller.responsable)}</p>
      </div>
      <button
        class="assign-button"
        type="button"
        data-company="${escapeHtml(seller.entreprise)}"
        aria-label="M’attribuer le vendeur ${escapeHtml(seller.entreprise)}"
        title="M’attribuer ce vendeur"
      >+</button>
    </article>
  `).join("");
}

function renderMyCases() {
  const myCases = sellers.filter((seller) => seller.assignee === CURRENT_USER);

  if (myCases.length === 0) {
    elements.myCasesList.innerHTML = '<p class="empty-state">Vous n’avez aucun dossier en cours.</p>';
    return;
  }

  elements.myCasesList.innerHTML = myCases.map((seller) => `
    <article class="seller-card">
      <div>
        <h3>${escapeHtml(seller.entreprise)}</h3>
        <p>Contact : ${escapeHtml(seller.responsable)}</p>
        <p class="card-note">${escapeHtml(seller.note)}</p>
      </div>
      <span class="status-pill" data-status="${escapeHtml(seller.statut)}">${escapeHtml(seller.statut)}</span>
    </article>
  `).join("");
}

function renderOverview() {
  const progressCount = sellers.filter((seller) => seller.statut === "En cours").length;
  const unassignedCount = sellers.filter((seller) => !seller.assignee).length;

  elements.totalCount.textContent = sellers.length;
  elements.progressCount.textContent = progressCount;
  elements.unassignedCount.textContent = unassignedCount;
}

function renderStatusFilter() {
  const selectedStatus = elements.statusFilter.value || "Tous";
  const statuses = [...new Set(sellers.map((seller) => seller.statut))];

  elements.statusFilter.innerHTML = ["Tous", ...statuses].map((status) => `
    <option value="${escapeHtml(status)}" ${status === selectedStatus ? "selected" : ""}>
      ${status === "Tous" ? "Tous les statuts" : escapeHtml(status)}
    </option>
  `).join("");
}

function renderTable() {
  const selectedStatus = elements.statusFilter.value;
  const visibleSellers = selectedStatus === "Tous"
    ? sellers
    : sellers.filter((seller) => seller.statut === selectedStatus);

  elements.tableBody.innerHTML = visibleSellers.map((seller) => `
    <tr>
      <td><strong>${escapeHtml(seller.entreprise)}</strong></td>
      <td>${escapeHtml(seller.responsable)}</td>
      <td><a href="mailto:${escapeHtml(seller.email)}">${escapeHtml(seller.email)}</a></td>
      <td><a href="tel:${escapeHtml(seller.telephone.replace(/\s/g, ""))}">${escapeHtml(seller.telephone)}</a></td>
      <td>${escapeHtml(seller.assignee || "Non assigné·e")}</td>
      <td><span class="status-pill" data-status="${escapeHtml(seller.statut)}">${escapeHtml(seller.statut)}</span></td>
      <td>${escapeHtml(seller.dateArrivee)}</td>
      <td>${escapeHtml(seller.note)}</td>
    </tr>
  `).join("");

  if (visibleSellers.length === 0) {
    elements.tableBody.innerHTML = '<tr><td colspan="8">Aucun vendeur ne correspond à ce filtre.</td></tr>';
  }

  const plural = visibleSellers.length > 1 ? "vendeurs affichés" : "vendeur affiché";
  elements.tableSummary.textContent = `${visibleSellers.length} ${plural} sur ${sellers.length}`;
}

function renderDashboard() {
  renderUnassignedCards();
  renderMyCases();
  renderOverview();
  renderStatusFilter();
  renderTable();
}

function showNotification(message) {
  window.clearTimeout(notificationTimer);
  elements.notification.textContent = message;
  elements.notification.classList.add("is-visible");

  notificationTimer = window.setTimeout(() => {
    elements.notification.classList.remove("is-visible");
  }, 3200);
}

function assignSeller(companyName) {
  const seller = sellers.find((item) => item.entreprise === companyName);

  if (!seller || seller.assignee) {
    return;
  }

  seller.assignee = CURRENT_USER;
  seller.statut = "En cours";
  renderDashboard();
  showNotification(`${seller.entreprise} est maintenant attribué à ${CURRENT_USER}.`);
}

elements.unassignedList.addEventListener("click", (event) => {
  const button = event.target.closest(".assign-button");

  if (button) {
    assignSeller(button.dataset.company);
  }
});

elements.statusFilter.addEventListener("change", renderTable);

document.addEventListener("DOMContentLoaded", async () => {
  sellers = await loadSellers();
  renderDashboard();
});
