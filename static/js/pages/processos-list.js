(function () {
    const form = document.querySelector("[data-process-filters-form]");
    const searchInput = document.querySelector("[data-process-search]");

    if (!form || !searchInput) {
        return;
    }

    let submitTimer = null;

    searchInput.addEventListener("input", function () {
        window.clearTimeout(submitTimer);
        submitTimer = window.setTimeout(function () {
            form.requestSubmit();
        }, 220);
    });
}());
