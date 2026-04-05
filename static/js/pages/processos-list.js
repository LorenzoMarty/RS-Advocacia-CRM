(function () {
    const form = document.querySelector("[data-process-filters-form]");
    const searchInput = document.querySelector("[data-process-search]");
    const head = document.querySelector(".process-head");
    const list = document.querySelector(".process-list");
    const emptyState = document.querySelector("[data-process-empty]");
    const countBadge = document.querySelector("[data-list-count]");
    const rows = Array.from(document.querySelectorAll("[data-process-row]"));

    if (!form || !searchInput) {
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
        let visibleCount = 0;

        rows.forEach(function (row) {
            const isVisible = !search || normalize(row.textContent).includes(search);
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

    applyFilters();
}());
