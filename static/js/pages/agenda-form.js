(function () {
    const clientSelect = document.getElementById("id_cliente");
    const processSelect = document.getElementById("id_processo");

    if (!clientSelect || !processSelect) {
        return;
    }

    const allProcessOptions = Array.from(processSelect.options).map(function (option) {
        return {
            value: option.value,
            label: option.textContent,
            clientId: option.dataset.clientId || "",
            disabled: option.disabled,
        };
    });

    function appendOption(config, selectedValue) {
        const option = new Option(config.label, config.value, false, config.value === selectedValue);
        option.disabled = config.disabled;

        if (config.clientId) {
            option.dataset.clientId = config.clientId;
        }

        processSelect.add(option);
    }

    function syncProcessOptions() {
        const selectedClientId = clientSelect.value;
        const currentProcessValue = processSelect.value;
        const visibleOptions = allProcessOptions.filter(function (option) {
            return option.value === "" || !selectedClientId || option.clientId === selectedClientId;
        });

        const nextProcessValue = visibleOptions.some(function (option) {
            return option.value === currentProcessValue;
        }) ? currentProcessValue : "";

        processSelect.innerHTML = "";
        visibleOptions.forEach(function (option) {
            appendOption(option, nextProcessValue);
        });

        const placeholder = processSelect.options[0];
        if (placeholder && placeholder.value === "") {
            placeholder.textContent = selectedClientId && visibleOptions.length === 1
                ? "Nenhum processo deste cliente"
                : "Selecione o processo";
        }

        processSelect.dispatchEvent(new Event("input", { bubbles: true }));
        processSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }

    clientSelect.addEventListener("change", syncProcessOptions);
    syncProcessOptions();
}());
