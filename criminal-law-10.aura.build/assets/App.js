<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <meta
      name="trustpilot-one-time-domain-verification-id"
      content="e7fde8c5-aaf9-473a-b59e-d1f4a8847cd8"
    />

    <!-- Static SEO for main domain (aura.build) - removed on subdomains/custom domains -->
    <meta
      name="description"
      data-static-seo="true"
      content="AI landing page builder that creates stunning designs in seconds. No design skills needed. Export to HTML & Figma. Trusted by 177,000+ users worldwide."
    />
    <title data-static-seo="true">Aura – AI Website Builder</title>

    <meta property="og:type" content="website" data-static-seo="true" />
    <meta property="og:site_name" content="Aura" data-static-seo="true" />
    <meta
      property="og:title"
      content="Aura – AI Website Builder"
      data-static-seo="true"
    />
    <meta
      property="og:description"
      content="AI landing page builder that creates stunning designs in seconds. No design skills needed. Export to HTML & Figma. Trusted by 177,000+ users worldwide."
      data-static-seo="true"
    />
    <meta
      property="og:image"
      content="https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/learn-assets/seo-previews/2026-05-22/share-preview.jpg"
      data-static-seo="true"
    />
    <meta
      property="og:url"
      content="https://aura.build/"
      data-static-seo="true"
    />
    <meta property="og:image:width" content="1200" data-static-seo="true" />
    <meta property="og:image:height" content="630" data-static-seo="true" />

    <meta
      name="twitter:card"
      content="summary_large_image"
      data-static-seo="true"
    />
    <meta name="twitter:site" content="@AuraBuilds" data-static-seo="true" />
    <meta
      name="twitter:title"
      content="Aura – AI Website Builder"
      data-static-seo="true"
    />
    <meta
      name="twitter:description"
      content="AI landing page builder that creates stunning designs in seconds. No design skills needed. Export to HTML & Figma. Trusted by 177,000+ users worldwide."
      data-static-seo="true"
    />
    <meta
      name="twitter:image"
      content="https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/learn-assets/seo-previews/2026-05-22/share-preview.jpg"
      data-static-seo="true"
    />
    <link
      rel="alternate"
      type="text/plain"
      href="https://aura.build/llms.txt"
      data-static-seo="true"
    />
    <script type="application/ld+json" data-static-seo="true">
      {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": "https://aura.build/#organization",
            "name": "Aura",
            "url": "https://aura.build/",
            "logo": "https://aura.build/logo-aura.svg",
            "sameAs": ["https://twitter.com/mengto"]
          },
          {
            "@type": "WebSite",
            "@id": "https://aura.build/#website",
            "name": "Aura",
            "url": "https://aura.build/",
            "publisher": {
              "@id": "https://aura.build/#organization"
            },
            "potentialAction": {
              "@type": "SearchAction",
              "target": "https://aura.build/assets?q={search_term_string}",
              "query-input": "required name=search_term_string"
            }
          },
          {
            "@type": "SoftwareApplication",
            "@id": "https://aura.build/#software",
            "name": "Aura",
            "applicationCategory": "DesignApplication",
            "operatingSystem": "Web",
            "url": "https://aura.build/",
            "description": "AI landing page builder that creates stunning designs in seconds. No design skills needed. Export to HTML & Figma.",
            "image": "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/learn-assets/seo-previews/2026-05-22/share-preview.jpg",
            "creator": {
              "@id": "https://aura.build/#organization"
            }
          }
        ]
      }
    </script>

    <!-- Remove Aura SEO/marketing tags on subdomains/custom domains BEFORE page renders -->
    <script>
      (function () {
        var h = location.hostname || "";
        var main = [
          "aura.build",
          "aura.page",
          "aurachat.io",
          "localhost",
          "netlify.app",
          "vercel.app",
        ];
        var isMain = main.some(function (d) {
          return h === d || h.endsWith("." + d);
        });
        var remove = false;
        if (isMain) {
          var parts = h.split(".");
          var isLocal = h.endsWith(".localhost");
          var isPreview =
            h.endsWith(".netlify.app") || h.endsWith(".vercel.app");
          var sub =
            parts.length > 2
              ? parts[0]
              : isLocal && parts.length === 2
                ? parts[0]
                : "";
          remove =
            ((sub && !isPreview) || (sub && isLocal)) &&
            sub.toLowerCase() !== "www";
        } else {
          remove = true;
        }
        if (remove) {
          var els = document.querySelectorAll("[data-static-seo]");
          for (var i = 0; i < els.length; i++)
            els[i].parentNode.removeChild(els[i]);
        }
      })();
    </script>

    <!-- Google tag (gtag.js) - internal domains only -->
    <script>
      (function () {
        var h = location.hostname || "";
        var internal =
          h === "aura.build" ||
          h === "www.aura.build" ||
          h === "beta--aurachatapp.netlify.app" ||
          h === "localhost" ||
          h.endsWith(".localhost");
        if (!internal) return;
        var s = document.createElement("script");
        s.async = true;
        s.src = "https://www.googletagmanager.com/gtag/js?id=G-2M6V79H761";
        document.head.appendChild(s);
        window.dataLayer = window.dataLayer || [];
        window.gtag =
          window.gtag ||
          function () {
            window.dataLayer.push(arguments);
          };
        window.gtag("js", new Date());
        window.gtag("config", "G-2M6V79H761");
      })();
    </script>

    <!-- Favicon (removed on subdomains/custom domains where custom favicon takes over) -->
    <link
      rel="icon"
      type="image/png"
      href="/logo-aura-128-light.png"
      media="(prefers-color-scheme: light)"
      data-static-seo="true"
    />
    <link
      rel="icon"
      type="image/png"
      href="/logo-aura-128-dark.png"
      media="(prefers-color-scheme: dark)"
      data-static-seo="true"
    />
    <link
      rel="icon"
      type="image/png"
      href="/logo-aura-128-light.png"
      data-static-seo="true"
    />
    <link
      rel="apple-touch-icon"
      href="/logo-aura-128-light.png"
      data-static-seo="true"
    />

    <!-- Fonts -->
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
    />

    <!-- Iconify Icon Web Component -->
    <script
      src="https://cdn.jsdelivr.net/npm/iconify-icon@2.1.0/dist/iconify-icon.min.js"
      integrity="sha384-GPb5RlngihS9H0z1D137JsvzmeZ7tCpWEF4t5YDoTZyMsPP8S7h7vFDh4XhheU83"
      crossorigin="anonymous"
    ></script>
    <script type="module" crossorigin src="/assets/index-CfCkHxL9.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-CuB4F1cI.css">
    <link rel="sitemap" type="application/xml" title="Sitemap" href="/sitemap.xml">
  </head>

  <body>
    <div id="root"></div>
  </body>
</html>
