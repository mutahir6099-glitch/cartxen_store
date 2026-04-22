// ============================================================
// cartxen_store — site logic
// ============================================================

const WHATSAPP_NUMBER = "923273032424";
const STORAGE_CART = "cartxen_cart";
const STORAGE_WISH = "cartxen_wishlist";

// ---------- utilities ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const formatPrice = (n) => "Rs " + n.toLocaleString("en-PK");
const parsePrice = (str) => parseInt(String(str).replace(/[^0-9]/g, ""), 10) || 0;

const storage = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
};

const openWhatsApp = (message) => {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener");
};

// ---------- toast notifications ----------
const toast = (() => {
  let container;
  const ensure = () => {
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    return container;
  };
  const icons = { success: "fa-circle-check", error: "fa-circle-exclamation", info: "fa-circle-info" };
  return (message, type = "info", duration = 2600) => {
    const c = ensure();
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${message}</span>`;
    c.appendChild(t);
    setTimeout(() => {
      t.classList.add("leaving");
      t.addEventListener("animationend", () => t.remove(), { once: true });
    }, duration);
  };
})();

// ---------- wishlist ----------
const wishlist = {
  items: storage.get(STORAGE_WISH, []),
  save() { storage.set(STORAGE_WISH, this.items); this.sync(); },
  has(id) { return this.items.includes(id); },
  toggle(id, name) {
    const i = this.items.indexOf(id);
    if (i > -1) {
      this.items.splice(i, 1);
      this.save();
      toast(`Removed ${name} from wishlist`, "info");
      return false;
    }
    this.items.push(id);
    this.save();
    toast(`Added ${name} to wishlist`, "success");
    return true;
  },
  sync() {
    const badge = $("#wishlistCount");
    if (badge) {
      badge.textContent = this.items.length;
      badge.classList.toggle("visible", this.items.length > 0);
    }
    $$(".wishlist-btn").forEach(btn => {
      const id = btn.dataset.id;
      btn.classList.toggle("active", this.has(id));
      const icon = btn.querySelector("i");
      if (icon) icon.className = this.has(id) ? "fa-solid fa-heart" : "fa-regular fa-heart";
    });
  }
};

// ---------- cart ----------
const cart = {
  items: storage.get(STORAGE_CART, []),
  save() { storage.set(STORAGE_CART, this.items); this.render(); this.syncBadge(); },
  add(product) {
    const existing = this.items.find(i => i.id === product.id);
    if (existing) existing.qty += 1;
    else this.items.push({ ...product, qty: 1 });
    this.save();
    toast(`Added ${product.name} to cart`, "success");
    // Automatically open the cart drawer when an item is added
    if (typeof openCart === 'function') openCart();
  },
  remove(id) {
    this.items = this.items.filter(i => i.id !== id);
    this.save();
  },
  setQty(id, qty) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    item.qty = Math.max(1, qty);
    this.save();
  },
  clear() { this.items = []; this.save(); },
  total() { return this.items.reduce((sum, i) => sum + i.price * i.qty, 0); },
  count() { return this.items.reduce((sum, i) => sum + i.qty, 0); },
  syncBadge() {
    const badge = $("#cartCount");
    if (!badge) return;
    const n = this.count();
    badge.textContent = n;
    badge.classList.toggle("visible", n > 0);
  },
  render() {
    const body = $("#cartBody");
    const footer = $("#cartFooter");
    if (!body) return;

    if (this.items.length === 0) {
      body.innerHTML = `
        <div class="cart-empty">
          <i class="fa-solid fa-cart-shopping"></i>
          <h3 style="margin-bottom: 0.5rem;">Your cart is empty</h3>
          <p style="margin-bottom: 1.5rem;">Browse products and add your favourites.</p>
          <a href="products.html" class="btn btn-primary">Shop Now</a>
        </div>`;
      if (footer) footer.style.display = "none";
      return;
    }

    if (footer) footer.style.display = "block";
    body.innerHTML = this.items.map(item => `
      <div class="cart-item" data-id="${item.id}">
        <img src="${item.image}" alt="${item.name}" class="cart-item-img" onerror="this.src='https://placehold.co/60x60/141b2d/3b82f6?text=?'">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">${formatPrice(item.price)}</div>
          <div class="qty-controls">
            <button class="qty-btn" data-action="dec" aria-label="Decrease"><i class="fa-solid fa-minus"></i></button>
            <span class="qty-value">${item.qty}</span>
            <button class="qty-btn" data-action="inc" aria-label="Increase"><i class="fa-solid fa-plus"></i></button>
          </div>
        </div>
        <button class="cart-item-remove" data-action="remove" aria-label="Remove">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `).join("");

    const totalEl = $("#cartTotal");
    if (totalEl) totalEl.textContent = formatPrice(this.total());
  },
  orderMessage() {
    const lines = this.items.map(
      i => `• ${i.name} × ${i.qty} — ${formatPrice(i.price * i.qty)}`
    );
    return [
      "Hello! I'd like to place an order for the following:",
      "",
      ...lines,
      "",
      `*Subtotal: ${formatPrice(this.total())}*`,
      "I understand delivery charges apply. Please confirm the total amount and next steps."
    ].join("\n");
  }
};

// ---------- product card helpers ----------
const productFromCard = (card) => ({
  id: card.dataset.id,
  name: card.dataset.product,
  price: parsePrice(card.dataset.price),
  image: card.querySelector(".product-image")?.getAttribute("src") || ""
});

// ============================================================
// DOM ready
// ============================================================
document.addEventListener("DOMContentLoaded", () => {

  // ---------- mobile menu ----------
  const mobileMenuBtn = $("#mobileMenuBtn");
  const navLinks = $("#navLinks");
  if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener("click", () => {
      navLinks.classList.toggle("active");
      const icon = mobileMenuBtn.querySelector("i");
      icon.classList.toggle("fa-bars");
      icon.classList.toggle("fa-xmark");
    });
  }

  // ---------- navbar scroll state ----------
  const navbar = $(".navbar");
  if (navbar) {
    const onScroll = () => navbar.classList.toggle("scrolled", window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // ---------- assign IDs to static product cards ----------
  $$(".product-card").forEach(card => {
    if (!card.dataset.id) {
      const name = card.dataset.product || card.querySelector(".product-title")?.textContent || "";
      card.dataset.id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    }
    // lazy-load images
    const img = card.querySelector(".product-image");
    if (img && !img.loading) img.loading = "lazy";
  });

  // ---------- WhatsApp single-product order buttons ----------
  $$(".whatsapp-order-btn").forEach(button => {
    button.addEventListener("click", function () {
      const productName = this.dataset.product;
      const productPrice = this.dataset.price;
      const message =
        `Hello, I want to buy the *${productName}* (${productPrice}). ` +
        `I understand that delivery is NOT free and delivery charges will apply. ` +
        `Please let me know the total amount and how to place the order.`;
      openWhatsApp(message);
    });
  });

  // ---------- Add-to-cart buttons ----------
  $$(".add-cart-btn").forEach(btn => {
    btn.addEventListener("click", function () {
      const card = this.closest(".product-card");
      if (!card) return;
      cart.add(productFromCard(card));
    });
  });

  // ---------- Wishlist hearts ----------
  $$(".wishlist-btn").forEach(btn => {
    btn.addEventListener("click", function () {
      const card = this.closest(".product-card");
      if (!card) return;
      wishlist.toggle(card.dataset.id, card.dataset.product);
    });
  });
  wishlist.sync();

  // ---------- Cart drawer ----------
  const cartDrawer = $("#cartDrawer");
  const cartOverlay = $("#drawerOverlay");
  const cartToggle = $("#cartToggle");
  const cartClose = $("#cartClose");

  const openCart = () => {
    cartDrawer?.classList.add("open");
    cartOverlay?.classList.add("open");
    document.body.style.overflow = "hidden";
  };
  const closeCart = () => {
    cartDrawer?.classList.remove("open");
    cartOverlay?.classList.remove("open");
    document.body.style.overflow = "";
  };

  cartToggle?.addEventListener("click", openCart);
  cartClose?.addEventListener("click", closeCart);
  cartOverlay?.addEventListener("click", closeCart);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeCart(); });

  // Cart item interactions (delegated)
  $("#cartBody")?.addEventListener("click", e => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    const item = e.target.closest(".cart-item");
    if (!item) return;
    const id = item.dataset.id;
    const record = cart.items.find(i => i.id === id);
    if (!record) return;
    if (action === "inc") cart.setQty(id, record.qty + 1);
    else if (action === "dec") {
      if (record.qty <= 1) cart.remove(id);
      else cart.setQty(id, record.qty - 1);
    } else if (action === "remove") cart.remove(id);
  });

  $("#cartCheckout")?.addEventListener("click", () => {
    if (cart.items.length === 0) return;
    window.location.href = 'checkout.html';
  });
  $("#cartClear")?.addEventListener("click", () => {
    if (cart.items.length === 0) return;
    cart.clear();
    toast("Cart cleared", "info");
  });

  cart.render();
  cart.syncBadge();

  // ---------- Products page: search / filter / sort ----------
  const productsGrid = $("#productsGrid");
  if (productsGrid) {
    const allCards = $$(".product-card", productsGrid);
    const searchInput = $("#searchInput");
    const searchClear = $("#searchClear");
    const sortSelect = $("#sortSelect");
    const chipsWrap = $("#filterChips");
    const resultsMeta = $("#resultsMeta");

    const state = { query: "", category: "all", sort: "default" };

    // populate chip counts
    if (chipsWrap) {
      const counts = { all: allCards.length };
      allCards.forEach(c => {
        const cat = c.dataset.category || "other";
        counts[cat] = (counts[cat] || 0) + 1;
      });
      chipsWrap.querySelectorAll(".chip").forEach(chip => {
        const cat = chip.dataset.category;
        const n = counts[cat] ?? 0;
        const badge = chip.querySelector(".count");
        if (badge) badge.textContent = n;
      });
    }

    const applyFilters = () => {
      const q = state.query.trim().toLowerCase();
      let visibleCount = 0;

      // Build filtered + sorted list
      const shown = allCards.filter(card => {
        const matchesCat = state.category === "all" || card.dataset.category === state.category;
        const text = (card.dataset.product + " " + (card.querySelector("p")?.textContent || "")).toLowerCase();
        const matchesQ = !q || text.includes(q);
        return matchesCat && matchesQ;
      });

      const sortFns = {
        "price-asc": (a, b) => parsePrice(a.dataset.price) - parsePrice(b.dataset.price),
        "price-desc": (a, b) => parsePrice(b.dataset.price) - parsePrice(a.dataset.price),
        "name-asc": (a, b) => a.dataset.product.localeCompare(b.dataset.product),
        "name-desc": (a, b) => b.dataset.product.localeCompare(a.dataset.product),
      };
      if (sortFns[state.sort]) shown.sort(sortFns[state.sort]);

      // Hide everything first
      allCards.forEach(c => c.style.display = "none");

      // Re-append in order (this reorders the DOM)
      shown.forEach(c => {
        c.style.display = "";
        productsGrid.appendChild(c);
        visibleCount++;
      });

      // no-results message
      let none = $("#noResults");
      if (visibleCount === 0) {
        if (!none) {
          none = document.createElement("div");
          none.id = "noResults";
          none.className = "no-results";
          none.innerHTML = `
            <i class="fa-solid fa-magnifying-glass"></i>
            <h3 style="margin-bottom: 0.5rem;">No products found</h3>
            <p>Try adjusting your search or filters.</p>`;
          productsGrid.appendChild(none);
        }
      } else if (none) {
        none.remove();
      }

      if (resultsMeta) {
        resultsMeta.innerHTML = q
          ? `Showing <strong>${visibleCount}</strong> of <strong>${allCards.length}</strong> products for "<strong>${state.query}</strong>"`
          : `Showing <strong>${visibleCount}</strong> of <strong>${allCards.length}</strong> products`;
      }
    };

    searchInput?.addEventListener("input", e => {
      state.query = e.target.value;
      searchClear?.classList.toggle("visible", !!state.query);
      applyFilters();
    });

    searchClear?.addEventListener("click", () => {
      if (searchInput) { searchInput.value = ""; state.query = ""; }
      searchClear.classList.remove("visible");
      applyFilters();
      searchInput?.focus();
    });

    sortSelect?.addEventListener("change", e => {
      state.sort = e.target.value;
      applyFilters();
    });

    chipsWrap?.addEventListener("click", e => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      chipsWrap.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      state.category = chip.dataset.category;
      applyFilters();
    });

    // Select a category from URL hash (e.g. products.html#earphones)
    const applyHashCategory = () => {
      const hash = window.location.hash.replace("#", "");
      if (!hash || !chipsWrap) return;
      const chip = chipsWrap.querySelector(`.chip[data-category="${hash}"]`);
      if (!chip) return;
      chipsWrap.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      state.category = hash;
      applyFilters();
      // scroll to the toolbar (toolbar sits above the grid)
      const toolbar = document.querySelector(".toolbar");
      if (toolbar) {
        setTimeout(() => toolbar.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      }
    };

    applyFilters();
    applyHashCategory();
    window.addEventListener("hashchange", applyHashCategory);
  }

  // ---------- General contact button ----------
  $("#generalContactBtn")?.addEventListener("click", () => {
    openWhatsApp("Hello, I have a question about your products.");
  });

  // ---------- Contact form -> WhatsApp ----------
  const contactForm = $("#contactForm");
  contactForm?.addEventListener("submit", e => {
    e.preventDefault();
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const name = $("#cfName")?.value.trim();
    const topic = $("#cfTopic")?.value.trim();
    const message = $("#cfMessage")?.value.trim();
    
    if (!name || !message) {
      toast("Please fill in your name and message", "error");
      return;
    }

    // Visual feedback
    const originalContent = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Preparing...</span> <i class="fa-solid fa-circle-notch fa-spin"></i>`;
    
    const body = [
      `Hi, my name is ${name}.`,
      topic ? `Topic: ${topic}` : "",
      "",
      message
    ].filter(Boolean).join("\n");

    setTimeout(() => {
      openWhatsApp(body);
      contactForm.reset();
      toast("WhatsApp opened!", "success");
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalContent;
    }, 800);
  });

  // ---------- FAQ accordion ----------
  $$(".faq-question").forEach(q => {
    q.addEventListener("click", () => {
      const item = q.closest(".faq-item");
      if (!item) return;
      const isOpen = item.classList.contains("open");
      $$(".faq-item").forEach(i => i.classList.remove("open"));
      if (!isOpen) item.classList.add("open");
    });
  });

  // ---------- Back-to-top FAB ----------
  const fabTop = $("#fabTop");
  if (fabTop) {
    const onScroll = () => fabTop.classList.toggle("visible", window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    fabTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  // ---------- Floating WhatsApp ----------
  $("#fabWhatsapp")?.addEventListener("click", () => {
    openWhatsApp("Hello! I'd like to know more about your products.");
  });

  // ---------- Scroll reveal ----------
  const revealables = $$(".reveal");
  if (revealables.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealables.forEach(el => io.observe(el));
  } else {
    revealables.forEach(el => el.classList.add("in-view"));
  }

  // ---------- Animated stat counters ----------
  const stats = $$("[data-count]");
  if (stats.length && "IntersectionObserver" in window) {
    const animate = (el, target) => {
      const duration = 1400;
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.floor(target * eased).toLocaleString() + (el.dataset.suffix || "");
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          animate(e.target, parseInt(e.target.dataset.count, 10) || 0);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.3 });
    stats.forEach(s => io.observe(s));
  }

});
