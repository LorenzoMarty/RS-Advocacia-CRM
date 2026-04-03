(function () {
        const toggles = document.querySelectorAll("[data-password-toggle]");

        toggles.forEach(function (toggle) {
            const targetId = toggle.getAttribute("data-password-target");
            const input = document.getElementById(targetId);

            if (!input) {
                return;
            }

            toggle.addEventListener("click", function () {
                const isVisible = input.type === "text";
                input.type = isVisible ? "password" : "text";
                toggle.classList.toggle("is-visible", !isVisible);
                toggle.setAttribute("aria-label", isVisible ? "Mostrar senha" : "Ocultar senha");
                toggle.setAttribute("title", isVisible ? "Mostrar senha" : "Ocultar senha");
            });
        });
    }());
