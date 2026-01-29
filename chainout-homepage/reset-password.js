(function () {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    const tokenErrorEl = document.getElementById('tokenError');
    const form = document.getElementById('resetForm');
    const passwordInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirmPassword');
    const formError = document.getElementById('formError');
    const formSuccess = document.getElementById('formSuccess');
    const submitButton = document.getElementById('submitButton');
    const buttonText = document.getElementById('buttonText');
    const buttonSpinner = document.getElementById('buttonSpinner');
    const statusText = document.getElementById('statusText');

    if (!form) {
      console.error('Form element not found');
      return;
    }

    if (!token) {
      if (tokenErrorEl) tokenErrorEl.style.display = 'block';
      if (form) form.style.display = 'none';
      if (statusText) statusText.textContent = 'No valid reset token was found in the link.';
      return;
    }

    function setLoading(isLoading) {
      if (submitButton) submitButton.disabled = isLoading;
      if (buttonSpinner) buttonSpinner.style.display = isLoading ? 'inline-block' : 'none';
      if (buttonText) buttonText.textContent = isLoading ? 'Updating…' : 'Update password';
    }

    function showError(message) {
      if (formError) {
        formError.style.display = 'block';
        formError.textContent = message;
      }
      if (formSuccess) formSuccess.style.display = 'none';
    }

    function showSuccess(message) {
      if (formError) formError.style.display = 'none';
      if (formSuccess) {
        formSuccess.style.display = 'block';
        formSuccess.textContent = message;
      }
    }

    if (submitButton) {
      submitButton.addEventListener('click', () => {
        const password = passwordInput ? passwordInput.value.trim() : '';
        const confirmPassword = confirmInput ? confirmInput.value.trim() : '';

        if (!password || !confirmPassword) {
          showError('Please fill in both password fields.');
          return;
        }

        if (password.length < 6) {
          showError('Your password must be at least 6 characters long.');
          return;
        }

        if (password !== confirmPassword) {
          showError('The passwords do not match. Please try again.');
          return;
        }

        setLoading(true);
        if (formError) formError.style.display = 'none';

        fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token, password }),
        })
          .then(async (response) => {
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
              const message =
                data?.message ||
                (response.status === 400
                  ? 'This password reset link is invalid or has expired.'
                  : 'Something went wrong while updating your password.');
              showError(message);
              setLoading(false);
              return;
            }

            showSuccess('Your password has been updated. You can now close this page and log in to ChainOut.');
            if (statusText) {
              statusText.innerHTML =
                'Password updated successfully. You can now return to the app and log in with your new password.';
            }

            if (passwordInput) passwordInput.value = '';
            if (confirmInput) confirmInput.value = '';
            setLoading(false);
          })
          .catch((error) => {
            console.error('Error sending reset request:', error);
            showError('We could not reach the server. Please check your connection and try again.');
            setLoading(false);
          });
      });
    }
  }
})();
