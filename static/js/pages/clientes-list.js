(function () {
    const form = document.querySelector("[data-client-filters-form]");
    const searchInput = document.querySelector("[data-client-search]");
    const typeSelect = document.querySelector("[data-client-type-filter]");

    if (!form || !searchInput || !typeSelect) {
        return;
    }

    let submitTimer = null;

    function submitFilters() {
        window.clearTimeout(submitTimer);
        submitTimer = window.setTimeout(function () {
            form.requestSubmit();
        }, 220);
    }

    searchInput.addEventListener("input", submitFilters);
    typeSelect.addEventListener("change", function () {
        window.clearTimeout(submitTimer);
        form.requestSubmit();
    });
}());
