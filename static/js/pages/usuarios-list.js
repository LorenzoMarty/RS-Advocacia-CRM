(function () {
    const searchInput = document.querySelector("[data-page-search]");
    const head = document.querySelector(".users-head");
    const list = document.querySelector(".users-list");
    const emptyState = document.querySelector("[data-user-empty]");
    const countBadge = document.querySelector("[data-list-count]");
    const rows = Array.from(document.querySelectorAll("[data-user-row]"));

    if (!searchInput) {
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
            const searchableText = normalize(row.dataset.searchContent || "");
            const isVisible = !search || searchableText.includes(search);
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

    searchInput.addEventListener("input", applyFilters);
    searchInput.addEventListener("search", applyFilters);

    applyFilters();
}());
