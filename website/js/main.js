/* ===== GainAI Main JavaScript ===== */

document.addEventListener('DOMContentLoaded', function () {

  // ===== NAVBAR SCROLL EFFECT =====
  const navbar = document.getElementById('navbar');

  window.addEventListener('scroll', function () {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // ===== MOBILE MENU =====
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.getElementById('navLinks');

  if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener('click', function () {
      mobileMenuBtn.classList.toggle('active');
      navLinks.classList.toggle('mobile-open');
      document.body.style.overflow = navLinks.classList.contains('mobile-open') ? 'hidden' : '';
    });

    // Close mobile menu on link click
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileMenuBtn.classList.remove('active');
        navLinks.classList.remove('mobile-open');
        document.body.style.overflow = '';
      });
    });
  }

  // ===== SCROLL REVEAL ANIMATIONS =====
  const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');

  const revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach(function (el) {
    revealObserver.observe(el);
  });

  // ===== ANIMATED COUNTERS =====
  const counters = document.querySelectorAll('.counter');

  const counterObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var counter = entry.target;
        var target = parseInt(counter.getAttribute('data-target'), 10);
        var duration = 2000;
        var startTime = null;

        function animate(timestamp) {
          if (!startTime) startTime = timestamp;
          var progress = Math.min((timestamp - startTime) / duration, 1);
          // Ease out cubic
          var eased = 1 - Math.pow(1 - progress, 3);
          counter.textContent = Math.floor(eased * target);
          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            counter.textContent = target;
          }
        }

        requestAnimationFrame(animate);
        counterObserver.unobserve(counter);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(function (counter) {
    counterObserver.observe(counter);
  });

  // ===== INLINE COUNTERS (for featured visuals) =====
  var inlineCounters = document.querySelectorAll('.counter-inline');

  var inlineCounterObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var counter = entry.target;
        var target = parseInt(counter.getAttribute('data-target'), 10);
        var duration = 2000;
        var startTime = null;

        function animate(timestamp) {
          if (!startTime) startTime = timestamp;
          var progress = Math.min((timestamp - startTime) / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 3);
          counter.textContent = Math.floor(eased * target).toLocaleString();
          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            counter.textContent = target.toLocaleString();
          }
        }

        requestAnimationFrame(animate);
        inlineCounterObserver.unobserve(counter);
      }
    });
  }, { threshold: 0.5 });

  inlineCounters.forEach(function (counter) {
    inlineCounterObserver.observe(counter);
  });

  // ===== PROGRESS BAR ANIMATIONS =====
  var barFills = document.querySelectorAll('.mockup-bar-fill');

  var barObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('animated');
        barObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  barFills.forEach(function (bar) {
    barObserver.observe(bar);
  });

  // ===== INVOICE TIMELINE ANIMATIONS =====
  var timelineItems = document.querySelectorAll('.timeline-item');

  var timelineObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var items = entry.target.parentElement.querySelectorAll('.timeline-item');
        items.forEach(function (item, index) {
          setTimeout(function () {
            item.classList.add('animated');
          }, index * 200);
        });
        timelineObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  if (timelineItems.length > 0) {
    timelineObserver.observe(timelineItems[0]);
  }

  // ===== FAQ ACCORDION =====
  var faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(function (item) {
    var question = item.querySelector('.faq-question');
    question.setAttribute('aria-expanded', 'false');
    question.addEventListener('click', function () {
      var isActive = item.classList.contains('active');

      // Close all others
      faqItems.forEach(function (other) {
        other.classList.remove('active');
        other.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });

      // Toggle current
      if (!isActive) {
        item.classList.add('active');
        question.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // ===== CONTACT FORM VALIDATION =====
  var contactForm = document.getElementById('contactForm');
  var formSuccess = document.getElementById('formSuccess');

  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var isValid = true;

      // Clear previous errors
      contactForm.querySelectorAll('.form-group').forEach(function (group) {
        group.classList.remove('error');
      });

      // Validate required fields
      var firstName = document.getElementById('firstName');
      var lastName = document.getElementById('lastName');
      var email = document.getElementById('email');
      var service = document.getElementById('service');
      var message = document.getElementById('message');

      if (!firstName.value.trim()) {
        firstName.closest('.form-group').classList.add('error');
        isValid = false;
      }

      if (!lastName.value.trim()) {
        lastName.closest('.form-group').classList.add('error');
        isValid = false;
      }

      if (!email.value.trim() || !isValidEmail(email.value)) {
        email.closest('.form-group').classList.add('error');
        isValid = false;
      }

      if (!service.value) {
        service.closest('.form-group').classList.add('error');
        isValid = false;
      }

      if (!message.value.trim()) {
        message.closest('.form-group').classList.add('error');
        isValid = false;
      }

      if (isValid) {
        // Simulate form submission
        var btn = contactForm.querySelector('button[type="submit"]');
        btn.textContent = 'Sending...';
        btn.disabled = true;

        setTimeout(function () {
          contactForm.style.display = 'none';
          formSuccess.classList.add('show');
        }, 1500);
      }
    });

    // Clear error on input
    contactForm.querySelectorAll('input, textarea, select').forEach(function (input) {
      input.addEventListener('input', function () {
        this.closest('.form-group').classList.remove('error');
      });
      input.addEventListener('change', function () {
        this.closest('.form-group').classList.remove('error');
      });
    });
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // ===== SMOOTH SCROLL FOR ANCHOR LINKS =====
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;
      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ===== PARALLAX EFFECT ON HERO GLOW =====
  var hero = document.querySelector('.hero');
  if (hero) {
    window.addEventListener('scroll', function () {
      var scrolled = window.scrollY;
      if (scrolled < window.innerHeight) {
        hero.style.setProperty('--parallax-y', (scrolled * 0.3) + 'px');
      }
    });
  }

});
