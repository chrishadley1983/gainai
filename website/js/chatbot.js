/* ===== GainAI Chatbot ===== */

document.addEventListener('DOMContentLoaded', function () {

  var toggle = document.getElementById('chatbotToggle');
  var chatWindow = document.getElementById('chatbotWindow');
  var chatMessages = document.getElementById('chatMessages');
  var chatInput = document.getElementById('chatInput');
  var chatSend = document.getElementById('chatSend');
  var isOpen = false;
  var hasGreeted = false;

  // Knowledge base for the chatbot
  var responses = {
    greeting: {
      patterns: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'hiya'],
      reply: "Hello! Welcome to GainAI. I'm here to help you learn about our services. What would you like to know?",
      quickReplies: ['What services do you offer?', 'Tell me about pricing', 'How does it work?']
    },
    services: {
      patterns: ['services', 'what do you do', 'what do you offer', 'help with', 'what can you'],
      reply: "We offer three core services:\n\n1. **Local Visibility Management** — We manage your Google Business Profile with weekly posts, review responses, and performance tracking.\n\n2. **Invoice Payment Follow-Up** — Automated payment reminders that connect to your existing invoicing software.\n\n3. **Custom AI Automation** — From email triage to data extraction, we build bespoke AI workflows for your business.",
      quickReplies: ['Tell me about Local Visibility', 'Tell me about Invoice Automation', 'What about pricing?']
    },
    localVisibility: {
      patterns: ['local visibility', 'google business', 'google profile', 'local seo', 'map pack', 'google maps', 'gbp'],
      reply: "Our Local Visibility Management service handles your Google Business Profile so you don't have to. We publish keyword-optimised posts 3-7 times per week, respond to reviews, upload fresh images, and track your performance.\n\n46% of Google searches have local intent — if you're not in the top 3, your competitors are getting those customers instead.",
      quickReplies: ['What does it cost?', 'How quickly do I see results?', 'Book a free audit']
    },
    invoiceAutomation: {
      patterns: ['invoice', 'payment', 'chasing', 'late payment', 'cash flow', 'follow-up', 'follow up', 'reminders'],
      reply: "Our Invoice Payment Follow-Up system automates the entire chasing process. It sends professional reminders before, on, and after the due date — all in your brand voice, from your email address.\n\nIt connects to Xero, QuickBooks, FreeAgent, Sage, and more. Businesses that use due-date reminders get paid 14 days faster on average.",
      quickReplies: ['What does it cost?', 'Will clients know it\'s automated?', 'Book a free audit']
    },
    pricing: {
      patterns: ['pricing', 'cost', 'price', 'how much', 'packages', 'plans', 'affordable', 'budget'],
      reply: "Our Local Visibility packages start at just **\u00a359/month**:\n\n- **Starter** — \u00a359/mo (3 posts/week)\n- **Growth** — \u00a399/mo (4 posts/week) — Most Popular\n- **Premium** — \u00a3149/mo (daily posts)\n\nAll month-to-month, no contracts. For invoice automation and custom AI work, we provide tailored quotes based on your needs.",
      quickReplies: ['What\'s included in Growth?', 'How do I get started?', 'Book a free audit']
    },
    growthPackage: {
      patterns: ['growth package', 'growth plan', 'included in growth', 'what\'s in growth', 'popular'],
      reply: "The **Growth package (\u00a399/mo)** includes everything in Starter plus:\n\n- 4 keyword-optimised posts per week\n- Offer & event posts\n- Monthly performance report\n- Review response drafts\n- Keyword research & tracking\n\nIt's our most popular package because it hits the sweet spot of visibility and value.",
      quickReplies: ['How do I get started?', 'Is there a contract?', 'Book a free audit']
    },
    howItWorks: {
      patterns: ['how does it work', 'how it works', 'process', 'what happens', 'get started', 'onboarding', 'steps'],
      reply: "Getting started is simple:\n\n1. **Free Audit** — We review your current setup and show you the opportunities\n2. **Choose Your Package** — Pick what fits, no pressure\n3. **Discovery Call** — 15 minutes to understand your business and goals\n4. **We Get to Work** — First content ready within 5 working days\n\nYour total time commitment? About 15 minutes for setup, then 5 minutes a month to approve content.",
      quickReplies: ['Book a free audit', 'What does it cost?', 'How quickly will I see results?']
    },
    results: {
      patterns: ['results', 'how long', 'how quickly', 'timeline', 'when will i see', 'improvement'],
      reply: "Most clients see a noticeable increase in profile views and engagement within **4-8 weeks**. Ranking improvements in the local map pack typically take 2-3 months of consistent activity.\n\nFor invoice automation, most clients see measurable improvement in payment speed within the **first 30 days**.",
      quickReplies: ['What does it cost?', 'Is there a contract?', 'Book a free audit']
    },
    contract: {
      patterns: ['contract', 'cancel', 'cancellation', 'minimum', 'lock-in', 'commitment', 'month to month'],
      reply: "No contracts, no lock-in. All our packages are **month-to-month** — cancel anytime with 30 days' notice.\n\nIf you cancel, everything we've built stays on your profile. You keep all the content, reviews, and optimisations. We just stop producing new content.",
      quickReplies: ['What does it cost?', 'How do I get started?', 'Book a free audit']
    },
    automated: {
      patterns: ['will clients know', 'automated', 'personal', 'looks real', 'brand voice'],
      reply: "No, your clients won't know it's automated. Every message comes from **your email address**, uses **your branding**, and reads like a personal message.\n\nIf a client replies, it goes straight to your inbox. The system stops automatically the moment payment is received.",
      quickReplies: ['What does it cost?', 'What software does it connect to?', 'Book a free audit']
    },
    software: {
      patterns: ['xero', 'quickbooks', 'software', 'integrat', 'connect', 'freeagent', 'sage', 'wave', 'stripe'],
      reply: "We connect to all the major invoicing platforms:\n\n- Xero\n- QuickBooks\n- FreeAgent\n- Sage\n- Wave\n- Stripe Invoicing\n\nIf you're using spreadsheets or manual invoicing, we can work with that too. No need to switch software.",
      quickReplies: ['How does it work?', 'What does it cost?', 'Book a free audit']
    },
    audit: {
      patterns: ['book', 'audit', 'free audit', 'consultation', 'call', 'schedule', 'appointment'],
      reply: "Great choice! You can book a free audit by visiting our contact page. We'll review your current setup and show you exactly where the opportunities are — no obligation, no upselling.\n\nJust fill in the form and we'll get back to you within 24 hours.",
      quickReplies: ['Go to contact page', 'What happens in the audit?', 'What does it cost?']
    },
    thanks: {
      patterns: ['thank', 'thanks', 'cheers', 'ta', 'appreciate'],
      reply: "You're welcome! If you have any other questions, I'm here to help. Otherwise, you can always reach us at hello@gainaiservices.co.uk.",
      quickReplies: ['Book a free audit', 'What services do you offer?']
    },
    fallback: {
      reply: "I'm not sure I understand that one. I can help you with questions about our services, pricing, how it works, or booking a free audit. What would you like to know?",
      quickReplies: ['What services do you offer?', 'Tell me about pricing', 'How does it work?', 'Book a free audit']
    }
  };

  // Toggle chatbot
  toggle.addEventListener('click', function () {
    isOpen = !isOpen;
    toggle.classList.toggle('active');
    chatWindow.classList.toggle('open');
    toggle.setAttribute('aria-label', isOpen ? 'Close chat' : 'Open chat');

    if (isOpen && !hasGreeted) {
      hasGreeted = true;
      setTimeout(function () {
        addBotMessage("Hi there! I'm the GainAI assistant. How can I help you today?");
        addQuickReplies(['What services do you offer?', 'Tell me about pricing', 'How does it work?']);
      }, 500);
    }

    if (isOpen) {
      setTimeout(function () { chatInput.focus(); }, 300);
    }
  });

  // Send message
  function sendMessage() {
    var text = chatInput.value.trim();
    if (!text) return;

    addUserMessage(text);
    chatInput.value = '';

    // Show typing indicator
    showTyping();

    // Find response
    var response = findResponse(text);

    setTimeout(function () {
      hideTyping();
      addBotMessage(response.reply);
      if (response.quickReplies) {
        addQuickReplies(response.quickReplies);
      }
    }, 800 + Math.random() * 700);
  }

  chatSend.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  });

  function findResponse(input) {
    var lower = input.toLowerCase();

    // Check each response category
    var categories = Object.keys(responses);
    for (var i = 0; i < categories.length; i++) {
      var key = categories[i];
      if (key === 'fallback') continue;
      var category = responses[key];
      if (!category.patterns) continue;

      for (var j = 0; j < category.patterns.length; j++) {
        if (lower.indexOf(category.patterns[j]) !== -1) {
          return category;
        }
      }
    }

    return responses.fallback;
  }

  function addUserMessage(text) {
    removeQuickReplies();
    var div = document.createElement('div');
    div.className = 'chat-message user';
    div.textContent = text;
    chatMessages.appendChild(div);
    scrollToBottom();
  }

  function addBotMessage(text) {
    var div = document.createElement('div');
    div.className = 'chat-message bot';
    // Simple markdown-like bold
    div.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    chatMessages.appendChild(div);
    scrollToBottom();
  }

  function addQuickReplies(replies) {
    var container = document.createElement('div');
    container.className = 'quick-replies';

    replies.forEach(function (reply) {
      var btn = document.createElement('button');
      btn.className = 'quick-reply';
      btn.textContent = reply;
      btn.addEventListener('click', function () {
        if (reply === 'Go to contact page') {
          window.location.href = 'contact.html';
          return;
        }
        addUserMessage(reply);
        showTyping();
        var response = findResponse(reply);
        setTimeout(function () {
          hideTyping();
          addBotMessage(response.reply);
          if (response.quickReplies) {
            addQuickReplies(response.quickReplies);
          }
        }, 800 + Math.random() * 700);
      });
      container.appendChild(btn);
    });

    chatMessages.appendChild(container);
    scrollToBottom();
  }

  function removeQuickReplies() {
    var existing = chatMessages.querySelectorAll('.quick-replies');
    existing.forEach(function (el) { el.remove(); });
  }

  function showTyping() {
    var existing = chatMessages.querySelector('.chat-typing');
    if (existing) {
      existing.classList.add('show');
      return;
    }
    var div = document.createElement('div');
    div.className = 'chat-typing show';
    div.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    chatMessages.appendChild(div);
    scrollToBottom();
  }

  function hideTyping() {
    var typing = chatMessages.querySelector('.chat-typing');
    if (typing) typing.remove();
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

});
