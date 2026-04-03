(function () {
        const eventsData = document.getElementById("agenda-events-data");
        const events = (eventsData ? JSON.parse(eventsData.textContent || "[]") : []).map(function (item) {
            item.startDate = new Date(item.start);
            item.endDate = new Date(item.end);
            return item;
        }).filter(function (item) {
            return !Number.isNaN(item.startDate.getTime());
        });

        const monthLabel = document.querySelector("[data-calendar-month]");
        const calendarGrid = document.querySelector("[data-calendar-grid]");
        const calendarEmpty = document.querySelector("[data-calendar-empty]");
        const prevButton = document.querySelector("[data-calendar-prev]");
        const nextButton = document.querySelector("[data-calendar-next]");
        const searchInput = document.querySelector("[data-filter-search]");
        const typeSelect = document.querySelector("[data-filter-type]");
        const responsibleSelect = document.querySelector("[data-filter-responsible]");
        const statusSelect = document.querySelector("[data-filter-status]");
        const periodSelect = document.querySelector("[data-filter-period]");
        const noteToday = document.querySelector("[data-note-today]");
        const noteUpcoming = document.querySelector("[data-note-upcoming]");
        const noteOverdue = document.querySelector("[data-note-overdue]");
        const todayList = document.querySelector("[data-list-today]");
        const upcomingList = document.querySelector("[data-list-upcoming]");
        const overdueList = document.querySelector("[data-list-overdue]");
        const today = new Date();
        let viewDate = new Date(today.getFullYear(), today.getMonth(), 1);

        function normalize(value) {
            return (value || "")
                .toString()
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .trim();
        }

        function startOfDay(date) {
            return new Date(date.getFullYear(), date.getMonth(), date.getDate());
        }

        function isSameDay(left, right) {
            return left.getFullYear() === right.getFullYear()
                && left.getMonth() === right.getMonth()
                && left.getDate() === right.getDate();
        }

        function formatMonth(date) {
            return new Intl.DateTimeFormat("pt-BR", {
                month: "long",
                year: "numeric"
            }).format(date);
        }

        function formatDate(date) {
            return new Intl.DateTimeFormat("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            }).format(date);
        }

        function formatTime(date) {
            return new Intl.DateTimeFormat("pt-BR", {
                hour: "2-digit",
                minute: "2-digit"
            }).format(date);
        }

        function getEventContext(event) {
            return event.client || event.process || event.type || "Compromisso";
        }

        function getTypeKey(value) {
            const normalized = normalize(value);
            if (normalized.includes("audien")) return "audiencia";
            if (normalized.includes("reun")) return "reuniao";
            if (normalized.includes("prazo")) return "prazo";
            if (normalized.includes("tarefa") || normalized.includes("intern")) return "tarefa";
            return "audiencia";
        }

        function getStatusKey(value, completed) {
            const normalized = normalize(value);
            if (completed || normalized.includes("conclu")) return "success";
            if (normalized.includes("cancel") || normalized.includes("atras")) return "danger";
            if (normalized.includes("aguard") || normalized.includes("penden")) return "warn";
            return "gold";
        }

        function isOverdue(event) {
            return event.endDate < new Date() && !event.completed && !normalize(event.status).includes("conclu");
        }

        function fillSelectOptions(select, values) {
            values.forEach(function (value) {
                const option = document.createElement("option");
                option.value = value;
                option.textContent = value;
                select.appendChild(option);
            });
        }

        function setupFilters() {
            fillSelectOptions(typeSelect, Array.from(new Set(events.map(function (item) {
                return item.type;
            }).filter(Boolean))).sort());

            fillSelectOptions(responsibleSelect, Array.from(new Set(events.map(function (item) {
                return item.responsible;
            }).filter(Boolean))).sort());

            fillSelectOptions(statusSelect, Array.from(new Set(events.map(function (item) {
                return item.status;
            }).filter(Boolean))).sort());
        }

        function filteredEvents() {
            const search = normalize(searchInput.value);
            const type = normalize(typeSelect.value);
            const responsible = normalize(responsibleSelect.value);
            const status = normalize(statusSelect.value);
            const period = periodSelect.value;
            const todayStart = startOfDay(today);
            const nextWeek = new Date(todayStart);
            nextWeek.setDate(nextWeek.getDate() + 7);
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();

            return events.filter(function (event) {
                const haystack = normalize([
                    event.title,
                    event.client,
                    event.process,
                    event.type,
                    event.status,
                    event.responsible
                ].join(" "));

                if (search && !haystack.includes(search)) return false;
                if (type && normalize(event.type) !== type) return false;
                if (responsible && normalize(event.responsible) !== responsible) return false;
                if (status && normalize(event.status) !== status) return false;
                if (period === "today" && !isSameDay(event.startDate, today)) return false;
                if (period === "week" && (event.startDate < todayStart || event.startDate > nextWeek)) return false;
                if (period === "month" && (event.startDate.getMonth() !== currentMonth || event.startDate.getFullYear() !== currentYear)) return false;
                return true;
            }).sort(function (left, right) {
                return left.startDate - right.startDate;
            });
        }

        function renderCalendar(currentEvents) {
            calendarGrid.innerHTML = "";
            monthLabel.textContent = formatMonth(viewDate);

            const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
            const startOffset = (firstDay.getDay() + 6) % 7;
            const gridStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1 - startOffset);
            let hasVisibleEvents = false;

            for (let index = 0; index < 42; index += 1) {
                const cellDate = new Date(gridStart);
                cellDate.setDate(gridStart.getDate() + index);

                const dayEvents = currentEvents.filter(function (event) {
                    return isSameDay(event.startDate, cellDate);
                });

                if (dayEvents.length) {
                    hasVisibleEvents = true;
                }

                const day = document.createElement("article");
                day.className = "day-card";

                if (cellDate.getMonth() !== viewDate.getMonth()) day.classList.add("is-muted");
                if (isSameDay(cellDate, today)) day.classList.add("is-today");
                if (dayEvents.some(isOverdue)) day.classList.add("is-overdue");
                if (dayEvents.length) day.classList.add("has-events");

                const head = document.createElement("div");
                head.className = "day-head";
                head.innerHTML = '<span class="day-number">' + cellDate.getDate() + '</span><span class="day-dot"></span>';
                day.appendChild(head);

                const wrap = document.createElement("div");
                wrap.className = "day-events";

                dayEvents.slice(0, 2).forEach(function (event) {
                    const item = document.createElement("a");
                    item.className = "calendar-event type-" + getTypeKey(event.type);
                    if (isOverdue(event)) item.classList.add("is-overdue");
                    item.href = event.url;
                    const time = document.createElement("span");
                    time.className = "calendar-event-time";
                    time.textContent = formatTime(event.startDate);
                    const title = document.createElement("strong");
                    title.className = "calendar-event-title";
                    title.textContent = event.title;
                    const context = document.createElement("span");
                    context.className = "calendar-event-context";
                    context.textContent = getEventContext(event);
                    item.appendChild(time);
                    item.appendChild(title);
                    item.appendChild(context);
                    wrap.appendChild(item);
                });
                if (dayEvents.length > 2) {
                    const more = document.createElement("span");
                    more.className = "calendar-more";
                    more.textContent = "+" + (dayEvents.length - 2) + " compromissos";
                    wrap.appendChild(more);
                }

                day.appendChild(wrap);
                calendarGrid.appendChild(day);
            }

            calendarEmpty.hidden = hasVisibleEvents;
        }

        function buildSideItem(event) {
            const link = document.createElement("a");
            link.className = "side-item";
            link.href = event.url;

            const statusClass = getStatusKey(event.status, event.completed);
            link.innerHTML = ""
                + '<div class="side-top">'
                + '  <div>'
                + '    <h3 class="side-title">' + event.title + '</h3>'
                + '    <p class="side-time">' + formatDate(event.startDate) + ' â€¢ ' + formatTime(event.startDate) + '</p>'
                + '  </div>'
                + '  <span class="status-badge ' + statusClass + '">' + (event.status || "Ativo") + '</span>'
                + '</div>'
                + '<div class="side-meta">'
                + (event.type ? '<span class="meta-chip">' + event.type + '</span>' : "")
                + (event.responsible ? '<span class="meta-chip">' + event.responsible + '</span>' : "")
                + (event.client ? '<span class="meta-chip">' + event.client + '</span>' : "")
                + (event.process ? '<span class="meta-chip">' + event.process + '</span>' : "")
                + '</div>';

            return link;
        }

        function renderSideSection(target, items, emptyTitle, emptyCopy) {
            target.innerHTML = "";
            if (!items.length) {
                const empty = document.createElement("div");
                empty.className = "empty";
                empty.innerHTML = "<strong>" + emptyTitle + "</strong><p>" + emptyCopy + "</p>";
                target.appendChild(empty);
                return;
            }

            items.forEach(function (event) {
                target.appendChild(buildSideItem(event));
            });
        }

        function renderRail(currentEvents) {
            const todayStart = startOfDay(today);
            const tomorrowStart = new Date(todayStart);
            tomorrowStart.setDate(tomorrowStart.getDate() + 1);

            const todayEvents = currentEvents.filter(function (event) {
                return isSameDay(event.startDate, today);
            });
            const upcomingEvents = currentEvents.filter(function (event) {
                return event.startDate >= tomorrowStart;
            }).slice(0, 6);
            const overdueEvents = currentEvents.filter(isOverdue).slice(0, 6);

            noteToday.textContent = todayEvents.length ? "Eventos do dia" : "Sem eventos hoje";
            noteUpcoming.textContent = upcomingEvents.length ? "Em ordem cronologica" : "Sem proximos eventos";
            noteOverdue.textContent = overdueEvents.length ? "Pedem atencao" : "Nada em atraso";

            renderSideSection(todayList, todayEvents, "Sem eventos hoje.", "A agenda do dia aparece aqui.");
            renderSideSection(upcomingList, upcomingEvents, "Sem proximos eventos.", "Os proximos registros aparecem aqui.");
            renderSideSection(overdueList, overdueEvents, "Sem atrasos.", "Nenhum evento vencido.");
        }

        function render() {
            const currentEvents = filteredEvents();
            renderCalendar(currentEvents);
            renderRail(currentEvents);
        }

        [searchInput, typeSelect, responsibleSelect, statusSelect, periodSelect].forEach(function (element) {
            element.addEventListener("input", render);
            element.addEventListener("change", render);
        });

        prevButton.addEventListener("click", function () {
            viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
            render();
        });

        nextButton.addEventListener("click", function () {
            viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
            render();
        });

        setupFilters();
        render();
    }());
