"use strict";

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
  dataError: document.querySelector("#data-error"),
  dashboardSections: document.querySelectorAll(".dashboard-section"),
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
  const response = await fetch("data/sellers.csv", { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Le CSV n’a pas pu être chargé (${response.status}).`);
  }

  const csvSellers = parseCsv(await response.text());

  if (csvSellers.length === 0) {
    throw new Error("Le CSV ne contient aucun vendeur.");
  }

  return csvSellers;
}

function showLoadError(error) {
  console.error("Chargement des vendeurs impossible :", error);
  elements.dashboardSections.forEach((section) => {
    section.hidden = true;
  });
  elements.dataError.hidden = false;
}

function getSellerDetailsId(seller) {
  return `seller-details-${sellers.indexOf(seller)}`;
}

function renderSellerDetails(seller) {
  const detailsId = getSellerDetailsId(seller);
  const phoneLink = seller.telephone.replace(/\s/g, "");

  return `
    <dl id="${detailsId}" class="card-details" hidden>
      <div><dt>Entreprise</dt><dd>${escapeHtml(seller.entreprise)}</dd></div>
      <div><dt>Responsable</dt><dd>${escapeHtml(seller.responsable)}</dd></div>
      <div><dt>E-mail</dt><dd><a href="mailto:${escapeHtml(seller.email)}">${escapeHtml(seller.email)}</a></dd></div>
      <div><dt>Téléphone</dt><dd><a href="tel:${escapeHtml(phoneLink)}">${escapeHtml(seller.telephone)}</a></dd></div>
      <div><dt>Assigné·e</dt><dd>${escapeHtml(seller.assignee || "Non assigné·e")}</dd></div>
      <div><dt>Statut</dt><dd><span class="status-pill" data-status="${escapeHtml(seller.statut)}">${escapeHtml(seller.statut)}</span></dd></div>
      <div><dt>Date d’arrivée</dt><dd>${escapeHtml(seller.dateArrivee)}</dd></div>
      <div class="detail-wide"><dt>Note</dt><dd>${escapeHtml(seller.note)}</dd></div>
    </dl>
  `;
}

function renderCardToggle(seller, summaryContent) {
  const detailsId = getSellerDetailsId(seller);

  return `
    <button
      class="card-toggle"
      type="button"
      data-company="${escapeHtml(seller.entreprise)}"
      aria-expanded="false"
      aria-controls="${detailsId}"
      aria-label="Afficher les informations de ${escapeHtml(seller.entreprise)}"
    >
      <span class="card-summary">${summaryContent}</span>
      <span class="card-toggle-indicator" aria-hidden="true">⌄</span>
    </button>
  `;
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
      <div class="card-main-row">
        ${renderCardToggle(seller, `
          <h3>${escapeHtml(seller.entreprise)}</h3>
          <p>Contact : ${escapeHtml(seller.responsable)}</p>
        `)}
        <button
          class="assign-button"
          type="button"
          data-company="${escapeHtml(seller.entreprise)}"
          aria-label="M’attribuer le vendeur ${escapeHtml(seller.entreprise)}"
          title="M’attribuer ce vendeur"
        >+</button>
      </div>
      ${renderSellerDetails(seller)}
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
      <div class="card-main-row">
        ${renderCardToggle(seller, `
          <h3>${escapeHtml(seller.entreprise)}</h3>
          <p>Contact : ${escapeHtml(seller.responsable)}</p>
          <p class="card-note">${escapeHtml(seller.note)}</p>
        `)}
        <span class="status-pill card-status" data-status="${escapeHtml(seller.statut)}">${escapeHtml(seller.statut)}</span>
      </div>
      ${renderSellerDetails(seller)}
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

function toggleSellerCard(button) {
  const isExpanded = button.getAttribute("aria-expanded") === "true";
  const details = document.querySelector(`#${button.getAttribute("aria-controls")}`);
  const card = button.closest(".seller-card");
  const companyName = button.dataset.company;

  button.setAttribute("aria-expanded", String(!isExpanded));
  button.setAttribute(
    "aria-label",
    `${isExpanded ? "Afficher" : "Masquer"} les informations de ${companyName}`,
  );
  details.hidden = isExpanded;
  card.classList.toggle("is-expanded", !isExpanded);
}

function handleCardListClick(event) {
  const assignButton = event.target.closest(".assign-button");

  if (assignButton) {
    assignSeller(assignButton.dataset.company);
    return;
  }

  const toggleButton = event.target.closest(".card-toggle");

  if (toggleButton) {
    toggleSellerCard(toggleButton);
  }
}

function handleCardListKeydown(event) {
  const isActivationKey = event.key === "Enter" || event.key === " ";

  if (isActivationKey && event.target.matches(".card-toggle")) {
    event.preventDefault();
    toggleSellerCard(event.target);
  }
}

elements.unassignedList.addEventListener("click", handleCardListClick);
elements.myCasesList.addEventListener("click", handleCardListClick);
elements.unassignedList.addEventListener("keydown", handleCardListKeydown);
elements.myCasesList.addEventListener("keydown", handleCardListKeydown);

elements.statusFilter.addEventListener("change", renderTable);

document.addEventListener("DOMContentLoaded", async () => {
  try {
    sellers = await loadSellers();
    renderDashboard();
  } catch (error) {
    showLoadError(error);
  }
});
