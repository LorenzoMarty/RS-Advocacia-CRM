(function () {
            const instances = new Map();
            let openInstance = null;
            let selectCounter = 0;

            function nextId() {
                selectCounter += 1;
                return "rs-select-" + selectCounter;
            }

            function createChevronIcon() {
                return [
                    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
                    '<path d="m6 9 6 6 6-6"></path>',
                    "</svg>"
                ].join("");
            }

            function createCheckIcon() {
                return [
                    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
                    '<path d="m5 12 4.2 4.2L19 6.4"></path>',
                    "</svg>"
                ].join("");
            }

            function getLabelForSelect(select) {
                if (!select.labels || !select.labels.length) {
                    return null;
                }

                return select.labels[0];
            }

            function isSupportedSelect(select) {
                return select
                    && select.tagName === "SELECT"
                    && !select.multiple
                    && !(select.size && select.size > 1)
                    && select.dataset.rsSelect !== "off";
            }

            function PremiumSelect(select) {
                this.select = select;
                this.id = nextId();
                this.hideTimer = null;
                this.selectLabel = null;
                this.optionButtons = [];

                this.build();
                this.bind();
                this.observe();
                this.syncFromNative();
            }

            PremiumSelect.prototype.build = function () {
                const shell = document.createElement("div");
                shell.className = "rs-select";
                shell.dataset.rsSelectShell = this.id;

                const trigger = document.createElement("button");
                trigger.className = "rs-select-trigger";
                trigger.type = "button";
                trigger.setAttribute("aria-haspopup", "listbox");
                trigger.setAttribute("aria-expanded", "false");

                const value = document.createElement("span");
                value.className = "rs-select-value";
                value.id = this.id + "-value";

                const icon = document.createElement("span");
                icon.className = "rs-select-icon";
                icon.innerHTML = createChevronIcon();

                trigger.appendChild(value);
                trigger.appendChild(icon);

                const dropdown = document.createElement("div");
                dropdown.className = "rs-select-dropdown";
                dropdown.id = this.id + "-dropdown";
                dropdown.hidden = true;
                dropdown.dataset.side = "bottom";

                const list = document.createElement("div");
                list.className = "rs-select-list";
                list.setAttribute("role", "listbox");
                list.id = this.id + "-listbox";
                dropdown.appendChild(list);

                const parent = this.select.parentNode;
                parent.insertBefore(shell, this.select);
                shell.appendChild(this.select);
                shell.appendChild(trigger);
                document.body.appendChild(dropdown);

                this.shell = shell;
                this.trigger = trigger;
                this.value = value;
                this.dropdown = dropdown;
                this.list = list;

                this.select.classList.add("rs-native-select");
                this.select.dataset.rsEnhanced = "true";
                this.select.tabIndex = -1;
                this.select.setAttribute("aria-hidden", "true");

                this.trigger.setAttribute("aria-controls", this.dropdown.id);

                const label = getLabelForSelect(this.select);
                if (label) {
                    if (!label.id) {
                        label.id = this.id + "-label";
                    }
                    this.trigger.setAttribute("aria-labelledby", label.id + " " + value.id);
                    this.list.setAttribute("aria-labelledby", label.id);
                } else if (this.select.getAttribute("aria-label")) {
                    this.trigger.setAttribute("aria-label", this.select.getAttribute("aria-label"));
                    this.list.setAttribute("aria-label", this.select.getAttribute("aria-label"));
                } else if (this.select.name) {
                    this.trigger.setAttribute("aria-label", this.select.name);
                    this.list.setAttribute("aria-label", this.select.name);
                }

                this.rebuildOptions();
            };

            PremiumSelect.prototype.bind = function () {
                const self = this;

                this.trigger.addEventListener("click", function () {
                    if (self.select.disabled) {
                        return;
                    }
                    self.toggle();
                });

                this.trigger.addEventListener("keydown", function (event) {
                    if (self.select.disabled) {
                        return;
                    }

                    if (event.key === "ArrowDown") {
                        event.preventDefault();
                        self.open("next");
                    }

                    if (event.key === "ArrowUp") {
                        event.preventDefault();
                        self.open("previous");
                    }

                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        self.toggle();
                    }
                });

                this.dropdown.addEventListener("click", function (event) {
                    const optionButton = event.target.closest(".rs-select-option");
                    if (!optionButton || optionButton.classList.contains("is-disabled")) {
                        return;
                    }

                    self.selectByIndex(Number(optionButton.dataset.index));
                });

                this.dropdown.addEventListener("keydown", function (event) {
                    const current = event.target.closest(".rs-select-option");
                    if (!current) {
                        return;
                    }

                    if (event.key === "ArrowDown") {
                        event.preventDefault();
                        self.focusSiblingOption(current, 1);
                    }

                    if (event.key === "ArrowUp") {
                        event.preventDefault();
                        self.focusSiblingOption(current, -1);
                    }

                    if (event.key === "Home") {
                        event.preventDefault();
                        self.focusBoundaryOption("start");
                    }

                    if (event.key === "End") {
                        event.preventDefault();
                        self.focusBoundaryOption("end");
                    }

                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        self.selectByIndex(Number(current.dataset.index));
                    }

                    if (event.key === "Escape") {
                        event.preventDefault();
                        self.close(true);
                    }

                    if (event.key === "Tab") {
                        self.close(false);
                    }
                });

                this.select.addEventListener("change", function () {
                    self.syncFromNative();
                });

                this.select.addEventListener("input", function () {
                    self.syncFromNative();
                });

                this.select.addEventListener("focus", function () {
                    self.trigger.focus();
                });

                if (this.select.form) {
                    this.select.form.addEventListener("reset", function () {
                        window.setTimeout(function () {
                            self.syncFromNative();
                        }, 0);
                    });
                }
            };

            PremiumSelect.prototype.observe = function () {
                const self = this;
                this.selectObserver = new MutationObserver(function (mutations) {
                    let needsRebuild = false;
                    let needsSync = false;

                    mutations.forEach(function (mutation) {
                        if (mutation.type === "childList") {
                            needsRebuild = true;
                        }

                        if (mutation.type === "attributes") {
                            needsSync = true;
                            if (mutation.target.tagName === "OPTION" || mutation.target.tagName === "OPTGROUP") {
                                needsRebuild = true;
                            }
                        }
                    });

                    if (needsRebuild) {
                        self.rebuildOptions();
                    }

                    if (needsRebuild || needsSync) {
                        self.syncFromNative();
                    }
                });

                this.selectObserver.observe(this.select, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ["disabled", "label", "selected", "hidden"]
                });

                const field = this.select.closest(".field");
                if (field) {
                    this.fieldObserver = new MutationObserver(function () {
                        self.syncFromNative();
                    });
                    this.fieldObserver.observe(field, {
                        attributes: true,
                        attributeFilter: ["class"]
                    });
                }
            };

            PremiumSelect.prototype.rebuildOptions = function () {
                const fragment = document.createDocumentFragment();
                const optionButtons = [];
                const nativeOptions = Array.from(this.select.options);
                const self = this;

                function createOptionButton(option, optionIndex) {
                    if (option.hidden) {
                        return null;
                    }

                    const optionButton = document.createElement("button");
                    optionButton.type = "button";
                    optionButton.className = "rs-select-option";
                    optionButton.setAttribute("role", "option");
                    optionButton.tabIndex = -1;
                    optionButton.dataset.index = String(optionIndex);
                    optionButton.id = self.id + "-option-" + optionIndex;

                    if (option.disabled) {
                        optionButton.classList.add("is-disabled");
                    }

                    const copy = document.createElement("span");
                    copy.className = "rs-select-option-copy";

                    const text = document.createElement("span");
                    text.className = "rs-select-option-text";
                    text.textContent = option.textContent.trim();
                    copy.appendChild(text);

                    const mark = document.createElement("span");
                    mark.className = "rs-select-option-mark";
                    mark.innerHTML = createCheckIcon();

                    optionButton.appendChild(copy);
                    optionButton.appendChild(mark);
                    optionButtons.push(optionButton);

                    return optionButton;
                }

                Array.from(this.select.children).forEach(function (child) {
                    if (child.tagName === "OPTGROUP") {
                        const group = document.createElement("div");
                        group.className = "rs-select-group";

                        const label = document.createElement("div");
                        label.className = "rs-select-group-label";
                        label.textContent = child.label;
                        group.appendChild(label);

                        Array.from(child.children).forEach(function (option) {
                            const optionIndex = nativeOptions.indexOf(option);
                            const optionButton = createOptionButton(option, optionIndex);
                            if (optionButton) {
                                group.appendChild(optionButton);
                            }
                        });

                        fragment.appendChild(group);
                        return;
                    }

                    if (child.tagName === "OPTION") {
                        const optionIndex = nativeOptions.indexOf(child);
                        const optionButton = createOptionButton(child, optionIndex);
                        if (optionButton) {
                            fragment.appendChild(optionButton);
                        }
                    }
                });

                this.list.innerHTML = "";

                if (!fragment.childNodes.length) {
                    const emptyState = document.createElement("div");
                    emptyState.className = "rs-select-empty-state";
                    emptyState.textContent = "Sem opcoes disponiveis.";
                    this.list.appendChild(emptyState);
                } else {
                    this.list.appendChild(fragment);
                }

                this.optionButtons = optionButtons;
            };

            PremiumSelect.prototype.syncFromNative = function () {
                const selectedOption = this.select.options[this.select.selectedIndex] || this.select.options[0] || null;
                const hasPlaceholder = selectedOption && selectedOption.value === "";
                const isInvalid = this.select.matches(":invalid")
                    || this.select.getAttribute("aria-invalid") === "true"
                    || Boolean(this.select.closest(".has-error"));

                this.value.textContent = selectedOption ? selectedOption.textContent.trim() : "Selecionar";
                this.shell.classList.toggle("is-empty", Boolean(hasPlaceholder));
                this.shell.classList.toggle("is-invalid", Boolean(isInvalid));
                this.shell.classList.toggle("is-disabled", Boolean(this.select.disabled));
                this.trigger.disabled = this.select.disabled;

                this.optionButtons.forEach((button) => {
                    const option = this.select.options[Number(button.dataset.index)];
                    const isSelected = Boolean(option && option.selected);
                    const isDisabled = Boolean(option && option.disabled);

                    button.classList.toggle("is-selected", isSelected);
                    button.classList.toggle("is-disabled", isDisabled);
                    button.setAttribute("aria-selected", isSelected ? "true" : "false");
                });

                if (this.shell.classList.contains("is-open")) {
                    this.positionDropdown();
                }
            };

            PremiumSelect.prototype.getEnabledButtons = function () {
                return this.optionButtons.filter(function (button) {
                    return !button.classList.contains("is-disabled");
                });
            };

            PremiumSelect.prototype.getSelectedButton = function () {
                return this.optionButtons.find(function (button) {
                    return button.classList.contains("is-selected") && !button.classList.contains("is-disabled");
                }) || null;
            };

            PremiumSelect.prototype.focusBoundaryOption = function (boundary) {
                const enabledButtons = this.getEnabledButtons();
                if (!enabledButtons.length) {
                    return;
                }

                const target = boundary === "end"
                    ? enabledButtons[enabledButtons.length - 1]
                    : enabledButtons[0];

                target.focus();
            };

            PremiumSelect.prototype.focusSiblingOption = function (current, direction) {
                const enabledButtons = this.getEnabledButtons();
                const currentIndex = enabledButtons.indexOf(current);
                if (currentIndex === -1) {
                    this.focusBoundaryOption(direction > 0 ? "start" : "end");
                    return;
                }

                const nextIndex = currentIndex + direction;
                const target = enabledButtons[nextIndex] || enabledButtons[currentIndex];
                if (target) {
                    target.focus();
                }
            };

            PremiumSelect.prototype.focusForOpen = function (strategy) {
                const enabledButtons = this.getEnabledButtons();
                if (!enabledButtons.length) {
                    return;
                }

                const selectedButton = this.getSelectedButton();
                let target = selectedButton || enabledButtons[0];

                if (strategy === "next") {
                    target = selectedButton || enabledButtons[0];
                }

                if (strategy === "previous") {
                    target = selectedButton || enabledButtons[enabledButtons.length - 1];
                }

                target.focus();
            };

            PremiumSelect.prototype.positionDropdown = function () {
                const rect = this.trigger.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const dropdownWidth = Math.min(rect.width, viewportWidth - 16);
                const spaceBelow = viewportHeight - rect.bottom - 12;
                const spaceAbove = rect.top - 12;
                const side = (spaceBelow < 220 && spaceAbove > spaceBelow) ? "top" : "bottom";
                const availableHeight = Math.max(132, Math.min(side === "bottom" ? spaceBelow : spaceAbove, 320));

                this.dropdown.dataset.side = side;
                this.dropdown.style.width = dropdownWidth + "px";
                this.dropdown.style.setProperty("--rs-select-max-height", availableHeight + "px");

                const left = Math.min(Math.max(8, rect.left), viewportWidth - dropdownWidth - 8);
                this.dropdown.style.left = left + "px";

                const dropdownHeight = this.dropdown.offsetHeight;
                const top = side === "bottom"
                    ? rect.bottom + 8
                    : rect.top - dropdownHeight - 8;

                this.dropdown.style.top = Math.max(8, top) + "px";
            };

            PremiumSelect.prototype.open = function (strategy) {
                if (this.select.disabled) {
                    return;
                }

                if (openInstance && openInstance !== this) {
                    openInstance.close(false);
                }

                window.clearTimeout(this.hideTimer);
                this.rebuildOptions();
                this.syncFromNative();

                this.dropdown.hidden = false;
                this.dropdown.style.visibility = "hidden";
                this.shell.classList.add("is-open");
                this.trigger.setAttribute("aria-expanded", "true");
                this.positionDropdown();
                this.dropdown.style.visibility = "";

                window.requestAnimationFrame(() => {
                    this.dropdown.classList.add("is-open");
                });

                openInstance = this;
                this.focusForOpen(strategy || "next");
            };

            PremiumSelect.prototype.close = function (focusTrigger) {
                this.shell.classList.remove("is-open");
                this.trigger.setAttribute("aria-expanded", "false");
                this.dropdown.classList.remove("is-open");

                window.clearTimeout(this.hideTimer);
                this.hideTimer = window.setTimeout(() => {
                    if (!this.shell.classList.contains("is-open")) {
                        this.dropdown.hidden = true;
                    }
                }, 180);

                if (focusTrigger) {
                    this.trigger.focus();
                }

                if (openInstance === this) {
                    openInstance = null;
                }
            };

            PremiumSelect.prototype.toggle = function () {
                if (this.shell.classList.contains("is-open")) {
                    this.close(false);
                    return;
                }

                this.open("next");
            };

            PremiumSelect.prototype.selectByIndex = function (optionIndex) {
                if (Number.isNaN(optionIndex) || optionIndex < 0) {
                    return;
                }

                const option = this.select.options[optionIndex];
                if (!option || option.disabled) {
                    return;
                }

                if (this.select.selectedIndex !== optionIndex) {
                    this.select.selectedIndex = optionIndex;
                }

                this.select.dispatchEvent(new Event("input", { bubbles: true }));
                this.select.dispatchEvent(new Event("change", { bubbles: true }));
                this.syncFromNative();
                this.close(true);
            };

            function enhanceSelect(select) {
                if (!isSupportedSelect(select) || instances.has(select)) {
                    return;
                }

                instances.set(select, new PremiumSelect(select));
            }

            function enhanceAllSelects(root) {
                const scope = root || document;

                if (scope.matches && scope.matches("select")) {
                    enhanceSelect(scope);
                }

                scope.querySelectorAll && scope.querySelectorAll("select").forEach(function (select) {
                    enhanceSelect(select);
                });
            }

            document.addEventListener("click", function (event) {
                const label = event.target.closest("label[for]");

                if (label) {
                    const select = document.getElementById(label.getAttribute("for"));
                    const instance = select ? instances.get(select) : null;

                    if (instance && !instance.select.disabled) {
                        event.preventDefault();
                        instance.trigger.focus();
                        instance.open("next");
                        return;
                    }
                }

                if (openInstance
                    && !openInstance.shell.contains(event.target)
                    && !openInstance.dropdown.contains(event.target)) {
                    openInstance.close(false);
                }
            });

            document.addEventListener("keydown", function (event) {
                if (event.key === "Escape" && openInstance) {
                    openInstance.close(true);
                }
            });

            window.addEventListener("resize", function () {
                if (openInstance) {
                    openInstance.close(false);
                }
            });

            window.addEventListener("scroll", function () {
                if (openInstance) {
                    openInstance.close(false);
                }
            }, true);

            enhanceAllSelects(document);

            window.RSSelect = {
                refresh: function (root) {
                    enhanceAllSelects(root || document);
                    instances.forEach(function (instance) {
                        instance.rebuildOptions();
                        instance.syncFromNative();
                    });
                }
            };
        }());
