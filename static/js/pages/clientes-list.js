(function () {
    const form = document.querySelector("[data-client-filters-form]");
    const searchInput = document.querySelector("[data-client-search]");
    const typeSelect = document.querySelector("[data-client-type-filter]");
    const head = document.querySelector(".list-head");
    const list = document.querySelector(".clients-list");
    const emptyState = document.querySelector("[data-client-empty]");
    const countBadge = document.querySelector("[data-list-count]");
    const rows = Array.from(document.querySelectorAll("[data-client-row]"));

    if (!form || !searchInput || !typeSelect) {
        return;
    }

    function normalize(value) {
        return (value || "")
            .toString()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
    }

    function updateCount(total) {
        if (!countBadge) {
            return;
        }

        countBadge.textContent = total + (total === 1 ? " registro" : " registros");
    }

    function applyFilters() {
        const search = normalize(searchInput.value);
        const type = normalize(typeSelect.value);
        let visibleCount = 0;

        rows.forEach(function (row) {
            const searchableText = normalize(row.dataset.searchContent || "");
            const matchesSearch = !search || searchableText.includes(search);
            const matchesType = !type || type === "todos" || normalize(row.dataset.clientType) === type;
            const isVisible = matchesSearch && matchesType;

            row.hidden = !isVisible;

            if (isVisible) {
                visibleCount += 1;
            }
        });

        if (head) {
            head.hidden = visibleCount === 0;
        }

        if (list) {
            list.hidden = visibleCount === 0;
        }

        if (emptyState) {
            emptyState.hidden = visibleCount !== 0;
        }

        updateCount(visibleCount);
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        applyFilters();
    });

    searchInput.addEventListener("input", applyFilters);
    searchInput.addEventListener("search", applyFilters);
    typeSelect.addEventListener("change", applyFilters);

    applyFilters();
}());
