let currentRole = 'houseowner';

function ensureAdminDemoData() {
    if (!window.location.pathname.startsWith('/admin')) return;

    const defaultTenders = [
        {
            id: 'T-1001',
            owner: 'Mahesh Patil',
            title: '3BHK Villa at Hinjawadi',
            area: 'Hinjawadi',
            budget: '2400000',
            completion: '2026-09-20',
            status: 'pending_budget'
        },
        {
            id: 'T-1002',
            owner: 'Riya Deshmukh',
            title: 'Office Renovation Project',
            area: 'Baner',
            budget: '1800000',
            completion: '2026-08-15',
            status: 'pending_tender_admin'
        },
        {
            id: 'T-1003',
            owner: 'Anil Sharma',
            title: 'Residential Complex Work',
            area: 'Pimpri',
            budget: '3200000',
            completion: '2026-10-01',
            status: 'published'
        }
    ];

    if (!localStorage.getItem('working_tenders')) {
        localStorage.setItem('working_tenders', JSON.stringify(defaultTenders));
    }

    if (!localStorage.getItem('working_pending_users')) {
        localStorage.setItem('working_pending_users', JSON.stringify([
            { id: 4091, phone: '+91 99999 11111', role: 'Contractor', status: 'pending' },
            { id: 4092, phone: '+91 88888 22222', role: 'Vendor', status: 'pending' }
        ]));
    }

    if (!localStorage.getItem('working_verified_users')) {
        localStorage.setItem('working_verified_users', JSON.stringify([
            { id: 1001, phone: '+91 98765 43210', role: 'Owner', status: 'Verified' },
            { id: 2001, phone: '+91 91234 56789', role: 'Contractor', status: 'Verified' },
            { id: 3001, phone: '+91 99887 66554', role: 'Vendor', status: 'Verified' }
        ]));
    }

    if (!localStorage.getItem('adminStaffDatabase')) {
        localStorage.setItem('adminStaffDatabase', JSON.stringify([
            { email: 'super@buildtender.com', pass: 'root123', role: 'Super Admin' },
            { email: 'verify@buildtender.com', pass: 'verify123', role: 'Verify Admin' },
            { email: 'budget@buildtender.com', pass: 'budget123', role: 'Budget Admin' }
        ]));
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureAdminDemoData);
} else {
    ensureAdminDemoData();
}

function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Close modal if clicked outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = "none";
    }
}


// set current role 

function selectRole(element, role) {
    // Remove active class from all
    document.querySelectorAll('.role-card').forEach(card => {
        card.classList.remove('active');
    });
    // Add to clicked
    element.classList.add('active');
    currentRole = role;
}



// user register and login api 

function goToDashboard(mode) {

    if (mode === 'register'){

        const phone = document.getElementById('regPhone').value;
        const email = document.getElementById('regEmail').value;
        const pass = document.getElementById('regPass').value;

        console.log(`Registering user: ${phone}, ${email}, ${pass}, Role: ${currentRole}`);

        fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile: phone, email: email, password: pass, role: currentRole })
        })
        .then(async response => {
            const text = await response.text();
            let data = {};

            try {
                data = text ? JSON.parse(text) : {};
            } catch (error) {
                console.error('Non-JSON response received:', text);
                data = { success: false, message: 'Registration failed. Please try again.' };
            }

            return data;
        })
        .then(data => {
            console.log('Server Response:', data);
            if (data.success) {
                alert('Registration successful! Redirecting to dashboard...');
                window.location.href = data.redirect || `/${currentRole}/overview`;
            } else {
                alert(data.message || 'User already exists or registration failed. Please try again.');
            }
        })
        .catch(error => {
            console.error('Error during registration:', error);
            alert('An error occurred. Please try again later.');    
        });

        }

    if(mode == "login"){

        const role = document.getElementById("loginRole").value;
        const email = document.getElementById('loginEmail').value;
        const pass = document.getElementById('loginPass').value;

        console.log("role", role , "Email", email , "password", pass );

        fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: pass, role: role })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Server Response:', data);
            if (data.success) {
                alert('Login successful! Redirecting to dashboard...');
                window.location.href = data.redirect || `/${role}/dashboard`;
            } else {
                alert(data.message || 'Login failed. Please check your credentials.');
            }
        })
        .catch(error => {
            console.error('Error during login:', error);
            alert('An error occurred. Please try again later.');    
        }); 

        }
}


function submitAdmin() {
    const email = document.getElementById('adminEmail').value;
    const pass = document.getElementById('adminPass').value;

    fetch('/master-admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: pass })
    })
    .then(function (response) { return response.json(); })
    .then(function (data) {
        if (data.success) {
            window.location.href = data.redirect || '/master-admin';
        } else {
            alert(data.message || 'Intrusion Blocked: Invalid Admin Credentials.');
        }
    })
    .catch(function (err) {
        console.error(err);
        alert('Admin login failed. Please try again.');
    });
}

function initThemeToggle() {
    if (!document.body) return;

    const existingBtn = document.getElementById('theme-toggle-btn');
    if (existingBtn) return;

    const btn = document.createElement('button');
    btn.id = 'theme-toggle-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle theme');
    btn.innerHTML = '<i data-lucide="sun"></i>';
    btn.style.position = 'fixed';
    btn.style.bottom = '20px';
    btn.style.right = '20px';
    btn.style.zIndex = '9999';
    btn.style.background = 'var(--surface)';
    btn.style.border = '1px solid var(--surface-border)';
    btn.style.color = 'var(--text-main)';
    btn.style.padding = '12px';
    btn.style.borderRadius = '50%';
    btn.style.cursor = 'pointer';
    btn.style.boxShadow = '0 10px 20px rgba(0,0,0,0.2)';
    btn.title = 'Toggle Theme';

    const savedTheme = localStorage.getItem('theme');
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    const isLightMode = savedTheme ? savedTheme === 'light' : prefersLight;

    if (isLightMode) {
        document.documentElement.classList.add('light-theme');
        btn.innerHTML = '<i data-lucide="moon"></i>';
    }

    btn.onclick = () => {
        const isLight = document.documentElement.classList.toggle('light-theme');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        btn.innerHTML = isLight ? '<i data-lucide="moon"></i>' : '<i data-lucide="sun"></i>';
        if (window.lucide) lucide.createIcons();
    };

    document.body.appendChild(btn);
    if (window.lucide) lucide.createIcons();
}

function translatePageTo(langCode) {
    const targetLang = langCode || 'en';
    if (window.google && window.google.translate && window.google.translate.TranslateElement) {
        const container = document.getElementById('google_translate_element');
        if (container) {
            container.innerHTML = '';
            new google.translate.TranslateElement({
                pageLanguage: 'en',
                includedLanguages: 'en,hi,mr',
                layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
                autoDisplay: false
            }, 'google_translate_element');
        }

        const combo = document.querySelector('.goog-te-combo');
        if (combo) {
            combo.value = targetLang;
            combo.dispatchEvent(new Event('change'));
        }
        return;
    }

    const url = new URL('https://translate.google.com/translate');
    url.searchParams.set('sl', 'auto');
    url.searchParams.set('tl', targetLang);
    url.searchParams.set('u', window.location.href);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
}

function initLanguageSwitcher() {
    if (!document.body || document.getElementById('language-switcher')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'language-switcher';
    wrapper.style.position = 'fixed';
    wrapper.style.bottom = '84px';
    wrapper.style.right = '20px';
    wrapper.style.zIndex = '9998';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '8px';
    wrapper.style.alignItems = 'flex-end';

    const trigger = document.createElement('button');
    trigger.id = 'language-switch-btn';
    trigger.type = 'button';
    trigger.setAttribute('aria-label', 'Change language');
    trigger.textContent = 'EN';
    trigger.style.background = 'var(--surface)';
    trigger.style.border = '1px solid var(--surface-border)';
    trigger.style.color = 'var(--text-main)';
    trigger.style.padding = '10px 12px';
    trigger.style.borderRadius = '999px';
    trigger.style.cursor = 'pointer';
    trigger.style.boxShadow = '0 10px 20px rgba(0,0,0,0.2)';
    trigger.title = 'Change Language';

    const menu = document.createElement('div');
    menu.style.display = 'none';
    menu.style.flexDirection = 'column';
    menu.style.gap = '6px';
    menu.style.padding = '8px';
    menu.style.borderRadius = '12px';
    menu.style.background = 'var(--surface)';
    menu.style.border = '1px solid var(--surface-border)';
    menu.style.boxShadow = '0 10px 20px rgba(0,0,0,0.2)';
    menu.style.backdropFilter = 'blur(12px)';

    const options = [
        { label: 'English', code: 'en', short: 'EN' },
        { label: 'हिंदी', code: 'hi', short: 'हिं' },
        { label: 'मराठी', code: 'mr', short: 'MR' }
    ];

    const setActiveLanguage = (langCode, shortLabel) => {
        trigger.textContent = shortLabel;
        document.documentElement.lang = langCode;
        document.documentElement.setAttribute('data-language', langCode);
    };

    options.forEach(option => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = option.label;
        btn.style.padding = '8px 10px';
        btn.style.borderRadius = '8px';
        btn.style.border = '1px solid transparent';
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-main)';
        btn.style.cursor = 'pointer';
        btn.style.textAlign = 'left';
        btn.onclick = () => {
            setActiveLanguage(option.code, option.short);
            translatePageTo(option.code);
            menu.style.display = 'none';
        };
        menu.appendChild(btn);
    });

    trigger.onclick = () => {
        menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
    };

    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);
    document.body.appendChild(wrapper);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initThemeToggle();
        initLanguageSwitcher();
        initGlobalTranslate();
    });
} else {
    initThemeToggle();
    initLanguageSwitcher();
    initGlobalTranslate();
}

// Initialize Google Translate Globally
function initGlobalTranslate() {
    if(!document.getElementById('google_translate_element')) {
        const translateContainer = document.createElement('div');
        translateContainer.id = 'google_translate_element';
        translateContainer.style.position = 'fixed';
        translateContainer.style.bottom = '80px'; 
        translateContainer.style.right = '20px';
        translateContainer.style.zIndex = '9999';
        translateContainer.style.background = 'var(--surface)';
        translateContainer.style.padding = '0.5rem';
        translateContainer.style.borderRadius = '8px';
        translateContainer.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        translateContainer.style.border = '1px solid var(--surface-border)';
        document.body.appendChild(translateContainer);
    }

    window.googleTranslateElementInit = function() {
        new google.translate.TranslateElement({
            pageLanguage: 'en',
            includedLanguages: 'en,hi,mr',
            layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
            autoDisplay: false
        }, 'google_translate_element');
    };

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    document.body.appendChild(script);
}

// Auto-run on page load
// document.addEventListener("DOMContentLoaded", () => {
//     initThemeToggle();
//     initGlobalTranslate();
//     if(window.lucide) lucide.createIcons();
    
//     const user = JSON.parse(localStorage.getItem('currentUser'));

//     // Admin Security Lock
//     if(window.location.pathname.includes('admin') && !window.location.pathname.includes('admin-login.html') && !window.location.pathname.includes('index.html')) {
//         if(localStorage.getItem('adminAuth') !== 'true') {
//             window.location.replace('admin-login.html');
//             return;
//         }
//     }

//     if(!user) return;

//     // If on a dashboard, alter UI based on state
//     if(window.location.pathname.includes('dashboard') || window.location.pathname.includes('post-tender') || window.location.pathname.includes('marketplace')) {
        
//         // Change Pending Badges to Verified
//         if(user.isVerified) {
//             const badges = document.querySelectorAll('.status-badge.pending, .status-badge');
//             badges.forEach(b => {
//                 // If it's the owner/contractor badge, turn it green
//                 if(b.innerText.includes('Pending')) {
//                     b.innerText = 'Verified Identity';
//                     b.classList.remove('pending');
//                     b.style.background = 'rgba(34, 197, 94, 0.1)';
//                     b.style.color = '#22c55e';
//                     b.style.borderColor = 'rgba(34, 197, 94, 0.2)';
//                 }
//             });

//             // Hide the Verification Warning Banners
//             const banners = document.querySelectorAll('.verification-banner');
//             banners.forEach(b => b.style.display = 'none');

//             // Unlock Stats/Cards
//             const lockedCards = document.querySelectorAll('.stat-card.disabled');
//             lockedCards.forEach(c => {
//                 c.classList.remove('disabled');
//                 const lockText = c.querySelector('p');
//                 if(lockText && lockText.innerText.includes('Locked')) {
//                     lockText.innerText = 'Active (0)';
//                 }
//             });
//         }
//     }

//     // Global Document Uploader Logic (File Picker Setup)
//     document.querySelectorAll('.upload-card, .upload-zone').forEach(card => {
//         if(card.querySelector('input[type="file"]')) return;
        
//         const input = document.createElement('input');
//         input.type = 'file';
//         input.style.display = 'none';
//         card.appendChild(input);

//         card.addEventListener('click', () => input.click());

//         input.addEventListener('change', () => {
//             if(input.files && input.files[0]) {
//                 let p = card.querySelector('p');
//                 if(!p) {
//                     p = document.createElement('p');
//                     p.style.fontSize = '0.8rem';
//                     p.style.marginTop = '0.5rem';
//                     card.appendChild(p);
//                 }
//                 p.innerText = "Attached: " + input.files[0].name;
//                 p.style.color = '#22c55e';
//                 card.style.borderColor = '#22c55e';
//                 if(card.classList.contains('upload-card')) {
//                     card.style.background = 'rgba(34, 197, 94, 0.05)';
//                 }
//             }
//         });
//         card.style.cursor = 'pointer';
//     });

//     // Dashboard Mobile Menu button pop-up logic
//     const sidebarLogoContainer = document.querySelector('.sidebar-logo');
//     const sidebarNav = document.querySelector('.sidebar-nav');
    
//     if (sidebarLogoContainer && sidebarNav && window.innerWidth <= 768) {
//         const mobileMenuBtn = document.createElement('button');
//         mobileMenuBtn.innerHTML = '<i data-lucide="menu"></i>';
//         mobileMenuBtn.className = 'dashboard-mobile-btn';
//         mobileMenuBtn.style.background = 'transparent';
//         mobileMenuBtn.style.color = 'var(--text-main)';
//         mobileMenuBtn.style.border = '1px solid var(--surface-border)';
//         mobileMenuBtn.style.padding = '0.5rem';
//         mobileMenuBtn.style.borderRadius = '8px';
//         mobileMenuBtn.style.cursor = 'pointer';
//         mobileMenuBtn.style.display = 'flex';
//         mobileMenuBtn.style.alignItems = 'center';
//         mobileMenuBtn.style.justifyContent = 'center';
        
//         sidebarLogoContainer.appendChild(mobileMenuBtn);

//         mobileMenuBtn.addEventListener('click', (e) => {
//             sidebarNav.classList.toggle('menu-open');
//             if(sidebarNav.classList.contains('menu-open')) {
//                 mobileMenuBtn.innerHTML = '<i data-lucide="x"></i>';
//             } else {
//                 mobileMenuBtn.innerHTML = '<i data-lucide="menu"></i>';
//             }
//             if(window.lucide) lucide.createIcons();
//             e.stopPropagation();
//         });

//         document.addEventListener('click', (e) => {
//             if(sidebarNav.classList.contains('menu-open') && !sidebarNav.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
//                 sidebarNav.classList.remove('menu-open');
//                 mobileMenuBtn.innerHTML = '<i data-lucide="menu"></i>';
//                 if(window.lucide) lucide.createIcons();
//             }
//         });
//     }
// });

// Mobile Navigation Logic
function toggleMobileNav() {
    const navLinks = document.querySelector('.nav-links');
    if (navLinks.style.display === 'flex') {
        navLinks.style.display = 'none';
    } else {
        navLinks.style.display = 'flex';
        // Add mobile-specific styles block dynamically or handled in CSS
        navLinks.classList.add('mobile-active');
    }
}

function updateProfile(form, e) {
    e.preventDefault();
    let user = JSON.parse(localStorage.getItem('currentUser')) || {};
    const inputs = form.querySelectorAll('input, select');
    inputs.forEach(inp => {
        if(inp.placeholder === 'e.g. Haveli') user.taluka = inp.value;
        if(inp.placeholder === 'e.g. Pune') user.district = inp.value;
        if(inp.type === 'email') user.email = inp.value;
        if(inp.type === 'tel') user.phone = inp.value;
        if(inp.value === 'John Doe' && inp.type === 'text') user.name = inp.value;
    });
    localStorage.setItem('currentUser', JSON.stringify(user));
    alert('Profile Location Data Saved Permanently!');
}

function markFileSelected(input, multiple) {
    const zone = input.closest('.upload-zone');
    if (!zone) return;

    const label = zone.querySelector('.file-chosen');
    const files = input.files;

    if (!files || !files.length) {
        zone.classList.remove('has-file');
        if (label) {
            label.textContent = label.getAttribute('data-placeholder') || (multiple ? 'No files chosen' : 'No file chosen');
        }
        return;
    }

    zone.classList.add('has-file');
    if (!label) return;

    if (multiple && files.length > 1) {
        label.textContent = files.length + ' files selected';
    } else {
        label.textContent = files[0].name;
    }
}
