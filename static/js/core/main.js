(function () {
            const root = document.documentElement;
            const toggle = document.querySelector("[data-sidebar-toggle]");
            const themeToggle = document.querySelector("[data-theme-toggle]");
            const themeMeta = document.querySelector('meta[name="theme-color"]');
            const sidebarStorageKey = "rs-advocacia-sidebar-collapsed";

            function isDesktop() {
                return window.innerWidth > 1200;
            }

            function resolveSidebarCollapsed() {
                try {
                    return localStorage.getItem(sidebarStorageKey) === "true";
                } catch (error) {
                    return root.getAttribute("data-sidebar-collapsed") === "true";
                }
            }

            function setSidebarCollapsed(collapsed) {
                root.setAttribute("data-sidebar-collapsed", collapsed ? "true" : "false");
                try {
                    localStorage.setItem(sidebarStorageKey, collapsed ? "true" : "false");
                } catch (error) {}
                updateSidebarToggle();
            }

            function updateSidebarToggle() {
                if (!toggle) {
                    return;
                }

                const desktop = isDesktop();
                const expanded = desktop && root.getAttribute("data-sidebar-collapsed") !== "true";
                const label = expanded ? "Recolher sidebar" : "Expandir sidebar";

                toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
                toggle.setAttribute("aria-label", label);
                toggle.setAttribute("title", label);
            }

            function applyTheme(theme) {
                root.setAttribute("data-theme", theme);
                if (themeMeta) {
                    themeMeta.setAttribute("content", theme === "light" ? "#f3ede3" : "#0b0d12");
                }
                if (themeToggle) {
                    var nextTheme = theme === "light" ? "escuro" : "claro";
                    themeToggle.setAttribute("aria-label", "Ativar tema " + nextTheme);
                    themeToggle.setAttribute("title", "Ativar tema " + nextTheme);
                }
            }

            function resolveTheme() {
                try {
                    return localStorage.getItem("rs-advocacia-theme") || root.getAttribute("data-theme") || "dark";
                } catch (error) {
                    return root.getAttribute("data-theme") || "dark";
                }
            }

            function toggleTheme() {
                var nextTheme = resolveTheme() === "light" ? "dark" : "light";
                try {
                    localStorage.setItem("rs-advocacia-theme", nextTheme);
                } catch (error) {}
                applyTheme(nextTheme);
            }

            applyTheme(resolveTheme());
            setSidebarCollapsed(resolveSidebarCollapsed());

            if (toggle) {
                toggle.addEventListener("click", function () {
                    if (!isDesktop()) {
                        return;
                    }

                    setSidebarCollapsed(root.getAttribute("data-sidebar-collapsed") !== "true");
                });
            }

            if (themeToggle) {
                themeToggle.addEventListener("click", toggleTheme);
            }

            window.addEventListener("resize", function () {
                updateSidebarToggle();
            });
        }());
