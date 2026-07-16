(function() {
    'use strict';

    var OWNER_HASH = 'cfdbb37f33c79d68f9091c87161191c885e26ee940392cd2a68527e275924462';
    var SESSION_KEY = 'blogCompanionOwnerSession.v1';
    var PENDING_CLASS = 'owner-auth-pending';

    document.documentElement.classList.add(PENDING_CLASS);

    function toHex(buffer) {
        return Array.prototype.map.call(new Uint8Array(buffer), function(byte) {
            return byte.toString(16).padStart(2, '0');
        }).join('');
    }

    function sha256(value) {
        if (!window.crypto || !window.crypto.subtle) {
            return Promise.reject(new Error('当前浏览器不支持安全校验，请使用现代浏览器或通过 HTTPS/localhost 打开。'));
        }
        return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)).then(toHex);
    }

    function hasSession() {
        try {
            return localStorage.getItem(SESSION_KEY) === OWNER_HASH;
        } catch (e) {
            return false;
        }
    }

    function setSession() {
        localStorage.setItem(SESSION_KEY, OWNER_HASH);
    }

    function clearSession() {
        localStorage.removeItem(SESSION_KEY);
    }

    function unlock() {
        document.documentElement.classList.remove(PENDING_CLASS);
        document.body.classList.remove('owner-locked');
        var gate = document.getElementById('ownerGate');
        if (gate) gate.remove();
    }

    function renderGate(resolve) {
        document.body.classList.add('owner-locked');
        var gate = document.createElement('section');
        gate.className = 'owner-gate';
        gate.id = 'ownerGate';
        gate.innerHTML =
            '<form class="owner-gate-card" id="ownerGateForm">' +
                '<p class="panel-label">Owner Access</p>' +
                '<h1>主站伴生系统</h1>' +
                '<p class="owner-gate-copy">此页面只用于站长管理。请输入访问密钥解锁本机工作台。</p>' +
                '<label class="owner-gate-field">' +
                    '<span>访问密钥</span>' +
                    '<input type="password" id="ownerAccessKey" autocomplete="current-password" autofocus>' +
                '</label>' +
                '<p class="owner-gate-error" id="ownerGateError" role="alert"></p>' +
                '<div class="owner-gate-actions">' +
                    '<a class="ghost-btn" href="index.html">返回主站</a>' +
                    '<button type="submit" class="primary-btn">解锁</button>' +
                '</div>' +
            '</form>';
        document.body.appendChild(gate);

        var form = document.getElementById('ownerGateForm');
        var input = document.getElementById('ownerAccessKey');
        var error = document.getElementById('ownerGateError');

        form.addEventListener('submit', function(event) {
            event.preventDefault();
            error.textContent = '';
            sha256(input.value).then(function(hash) {
                if (hash !== OWNER_HASH) {
                    input.value = '';
                    input.focus();
                    error.textContent = '访问密钥不正确。';
                    return;
                }
                setSession();
                unlock();
                resolve(true);
            }).catch(function(err) {
                error.textContent = err.message || '无法完成安全校验。';
            });
        });
    }

    function requireAccess() {
        if (hasSession()) {
            if (document.body) unlock();
            return Promise.resolve(true);
        }
        return new Promise(function(resolve) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function() {
                    renderGate(resolve);
                }, { once: true });
                return;
            }
            renderGate(resolve);
        });
    }

    document.addEventListener('click', function(event) {
        var lockTarget = event.target.closest('[data-owner-lock]');
        if (!lockTarget) return;
        event.preventDefault();
        clearSession();
        window.location.href = 'index.html';
    });

    window.BLOG_OWNER_AUTH = {
        hash: OWNER_HASH,
        sessionKey: SESSION_KEY,
        hasSession: hasSession,
        requireAccess: requireAccess,
        signOut: function() {
            clearSession();
            window.location.href = 'index.html';
        }
    };
})();
