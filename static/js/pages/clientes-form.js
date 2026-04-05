(function () {
    const documentInput = document.querySelector("[data-cpf-cnpj-input]");

    if (!documentInput) {
        return;
    }

    const getDigits = function (value) {
        return value.replace(/\D/g, "").slice(0, 14);
    };

    const formatCpf = function (digits) {
        if (digits.length <= 3) {
            return digits;
        }

        if (digits.length <= 6) {
            return digits.slice(0, 3) + "." + digits.slice(3);
        }

        if (digits.length <= 9) {
            return digits.slice(0, 3) + "." + digits.slice(3, 6) + "." + digits.slice(6);
        }

        return digits.slice(0, 3) + "." + digits.slice(3, 6) + "." + digits.slice(6, 9) + "-" + digits.slice(9, 11);
    };

    const formatCnpj = function (digits) {
        if (digits.length <= 2) {
            return digits;
        }

        if (digits.length <= 5) {
            return digits.slice(0, 2) + "." + digits.slice(2);
        }

        if (digits.length <= 8) {
            return digits.slice(0, 2) + "." + digits.slice(2, 5) + "." + digits.slice(5);
        }

        if (digits.length <= 12) {
            return digits.slice(0, 2) + "." + digits.slice(2, 5) + "." + digits.slice(5, 8) + "/" + digits.slice(8);
        }

        return digits.slice(0, 2) + "." + digits.slice(2, 5) + "." + digits.slice(5, 8) + "/" + digits.slice(8, 12) + "-" + digits.slice(12, 14);
    };

    const formatDocument = function (value) {
        const digits = getDigits(value);

        if (digits.length > 11) {
            return formatCnpj(digits);
        }

        return formatCpf(digits);
    };

    const syncMaskedValue = function () {
        documentInput.value = formatDocument(documentInput.value);
    };

    syncMaskedValue();

    documentInput.addEventListener("input", syncMaskedValue);

    if (documentInput.form) {
        documentInput.form.addEventListener("submit", function () {
            documentInput.value = getDigits(documentInput.value);
        });
    }
}());
