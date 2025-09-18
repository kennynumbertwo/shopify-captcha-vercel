# Shopify CAPTCHA Verification Setup Guide

## Overview
This project provides a serverless CAPTCHA verification system for Shopify stores using Google reCAPTCHA and Vercel Functions with GitHub integration.

## Prerequisites
- Node.js 18+ installed
- Git installed
- GitHub account
- Google account for reCAPTCHA setup
- Access to Shopify store admin

## Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/[username]/shopify-captcha-vercel.git
cd shopify-captcha-vercel
```

### 2. Setup Environment Variables
```bash
cp .env.example .env.local
# Edit .env.local and add your reCAPTCHA secret key
```

### 3. Connect to Vercel
- Go to [vercel.com](https://vercel.com)
- Import this GitHub repository
- Add environment variables in Vercel dashboard
- Deploy automatically happens on git push

## Detailed Setup

### Google reCAPTCHA Configuration

1. **Create reCAPTCHA Site**
   - Go to [Google reCAPTCHA Console](https://www.google.com/recaptcha/admin)
   - Click "+" to add new site
   - Choose reCAPTCHA v3 (recommended) or v2
   - Add your Shopify domain: `yourstore.myshopify.com`

2. **Get Your Keys**
   - **Site Key**: Used in frontend (public, goes in Liquid templates)
   - **Secret Key**: Used in backend (private, goes in `.env.local`)

3. **Domain Configuration**
   - Add all domains where CAPTCHA will be used:
     - `yourstore.myshopify.com` (production)
     - `localhost` (for local testing)
     - Any preview domains

### Vercel + GitHub Integration

1. **Connect GitHub Repository to Vercel**
   - Go to [vercel.com](https://vercel.com) and login
   - Click "New Project"
   - Select "Import Git Repository"
   - Choose your `shopify-captcha-vercel` repository
   - Click "Import"

2. **Configure Project Settings**
   - **Project Name**: Keep as `shopify-captcha-vercel` or customize
   - **Framework Preset**: "Other" (default)
   - **Root Directory**: `./` (default)
   - Leave build settings empty (Vercel auto-detects)

3. **Add Environment Variables**
   - In Vercel dashboard → Project → Settings → Environment Variables
   - Add: `RECAPTCHA_SECRET_KEY` = `your_secret_key_here`
   - Select all environments: Production, Preview, Development
   - Click "Save"

4. **Initial Deployment**
   - First deployment happens automatically after import
   - Redeploy after adding environment variables
   - Note your deployment URL: `https://your-project.vercel.app`

### Local Development Setup

1. **Install Vercel CLI (Optional)**
   ```bash
   npm install -g vercel
   ```

2. **Local Testing**
   ```bash
   # Test function locally
   vercel dev
   # Visit http://localhost:3000/api/verify-captcha
   ```

3. **Environment Variables for Local Development**
   ```bash
   # Your .env.local should contain:
   RECAPTCHA_SECRET_KEY=your_secret_key_here
   ```

### Shopify Integration

1. **Add reCAPTCHA Script to Theme**
   In your theme's layout file or specific template:
   ```liquid
   <script src="https://www.google.com/recaptcha/api.js?render=YOUR_SITE_KEY"></script>
   ```

2. **Update CORS Configuration**
   In `vercel.json`, update the domain:
   ```json
   {
     "headers": [
       {
         "source": "/api/(.*)",
         "headers": [
           {
             "key": "Access-Control-Allow-Origin",
             "value": "https://yourstore.myshopify.com"
           }
         ]
       }
     ]
   }
   ```

## Frontend Implementation Examples

### reCAPTCHA v3 (Invisible - Recommended)

**Complete form implementation:**
```liquid
<form id="captcha-form" method="post">
  <div class="form-group">
    <label for="email">Email:</label>
    <input type="email" id="email" name="email" required>
  </div>
  
  <div class="form-group">
    <label for="message">Message:</label>
    <textarea id="message" name="message" required></textarea>
  </div>
  
  <button type="submit" id="submit-btn">Submit</button>
  
  <div id="form-status" style="display: none;"></div>
</form>

<script src="https://www.google.com/recaptcha/api.js?render=YOUR_SITE_KEY"></script>

<script>
document.getElementById('captcha-form').addEventListener('submit', function(e) {
  e.preventDefault();
  
  const submitBtn = document.getElementById('submit-btn');
  const statusDiv = document.getElementById('form-status');
  
  // Disable submit button
  submitBtn.disabled = true;
  submitBtn.textContent = 'Verifying...';
  
  grecaptcha.ready(function() {
    grecaptcha.execute('YOUR_SITE_KEY', {action: 'contact_form'})
    .then(function(token) {
      const formData = new FormData(e.target);
      
      const submitData = {
        token: token,
        action: 'contact_form',
        email: formData.get('email'),
        message: formData.get('message')
      };

      return fetch('https://your-project.vercel.app/api/verify-captcha', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData)
      });
    })
    .then(response => response.json())
    .then(data => {
      statusDiv.style.display = 'block';
      
      if (data.success) {
        statusDiv.innerHTML = '<p style="color: green;">✓ Form submitted successfully!</p>';
        e.target.reset();
        
        // Add your success logic here
        // e.g., redirect, show thank you message, etc.
        
      } else {
        statusDiv.innerHTML = `<p style="color: red;">✗ Verification failed: ${data.message}</p>`;
      }
    })
    .catch(error => {
      console.error('Error:', error);
      statusDiv.style.display = 'block';
      statusDiv.innerHTML = '<p style="color: red;">✗ An error occurred. Please try again.</p>';
    })
    .finally(() => {
      // Re-enable submit button
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
    });
  });
});
</script>
```

### reCAPTCHA v2 (Checkbox)

**Implementation with visible checkbox:**
```liquid
<form id="captcha-form-v2" method="post">
  <div class="form-group">
    <label for="email-v2">Email:</label>
    <input type="email" id="email-v2" name="email" required>
  </div>
  
  <div class="form-group">
    <label for="message-v2">Message:</label>
    <textarea id="message-v2" name="message" required></textarea>
  </div>
  
  <!-- reCAPTCHA widget -->
  <div class="g-recaptcha" data-sitekey="YOUR_SITE_KEY" data-callback="onRecaptchaSuccess"></div>
  
  <button type="submit" id="submit-btn-v2" disabled>Submit</button>
</form>

<script src="https://www.google.com/recaptcha/api.js" async defer></script>

<script>
let recaptchaToken = null;

function onRecaptchaSuccess(token) {
  recaptchaToken = token;
  document.getElementById('submit-btn-v2').disabled = false;
}

document.getElementById('captcha-form-v2').addEventListener('submit', function(e) {
  e.preventDefault();
  
  if (!recaptchaToken) {
    alert('Please complete the CAPTCHA');
    return;
  }
  
  const formData = new FormData(e.target);
  const submitData = {
    token: recaptchaToken,
    email: formData.get('email'),
    message: formData.get('message')
  };

  fetch('https://your-project.vercel.app/api/verify-captcha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submitData)
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      alert('Form submitted successfully!');
      e.target.reset();
      grecaptcha.reset(); // Reset CAPTCHA
      recaptchaToken = null;
      document.getElementById('submit-btn-v2').disabled = true;
    } else {
      alert('Verification failed: ' + data.message);
      grecaptcha.reset(); // Reset CAPTCHA on failure
      recaptchaToken = null;
      document.getElementById('submit-btn-v2').disabled = true;
    }
  })
  .catch(error => {
    console.error('Error:', error);
    alert('An error occurred. Please try again.');
  });
});
</script>
```

## Configuration Options

### Adjusting reCAPTCHA v3 Score Threshold

In `api/verify-captcha.js`, you can adjust the sensitivity:

```javascript
// More lenient (accepts more users, might allow some bots)
if (score !== undefined && score < 0.3) {
  return res.status(400).json({
    success: false,
    message: 'CAPTCHA verification failed - suspicious activity detected'
  });
}

// Default (balanced)
if (score !== undefined && score < 0.5) {
  // Current setting
}

// More strict (blocks more bots, might block some legitimate users)
if (score !== undefined && score < 0.7) {
  // Higher threshold
}
```

**Score Guidelines:**
- `0.9+`: Very likely human
- `0.7-0.9`: Likely human  
- `0.5-0.7`: Neutral (default threshold here)
- `0.3-0.5`: Suspicious
- `0.0-0.3`: Very likely bot

### CORS Configuration

Update `vercel.json` for your specific domain:

```json
{
  "functions": {
    "api/verify-captcha.js": {
      "maxDuration": 10
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "https://yourstore.myshopify.com"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "POST, OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "Content-Type"
        }
      ]
    }
  ]
}
```

## Development Workflow

### Making Changes

1. **Create feature branch (optional):**
   ```bash
   git checkout -b feature/improve-error-handling
   ```

2. **Make your changes:**
   ```bash
   # Edit files
   nano api/verify-captcha.js
   ```

3. **Test locally:**
   ```bash
   vercel dev
   # Test at http://localhost:3000
   ```

4. **Commit and push:**
   ```bash
   git add .
   git commit -m "Improve error handling and user feedback"
   git push origin feature/improve-error-handling
   ```

5. **Automatic deployment:**
   - Vercel automatically creates preview deployment
   - Test the preview URL
   - Merge to main branch for production deployment

### Environment Management

**For different environments:**

```bash
# Development (your testing)
# Use .env.local with test keys

# Staging (client preview)
# Use Vercel environment variables for preview

# Production (live store)
# Use Vercel environment variables for production
```

## Testing

### Local Testing

```bash
# Start local development server
vercel dev

# Test endpoint manually
curl -X POST http://localhost:3000/api/verify-captcha \
  -H "Content-Type: application/json" \
  -d '{"token":"test-token","action":"submit"}'
```

### Production Testing

```bash
# Test production endpoint
curl -X POST https://your-project.vercel.app/api/verify-captcha \
  -H "Content-Type: application/json" \
  -d '{"token":"valid-recaptcha-token","action":"submit"}'
```

### Integration Testing

1. **Create test page** with your form implementation
2. **Test with real reCAPTCHA** tokens
3. **Verify in both browsers** (Chrome, Safari, Firefox)
4. **Test on mobile devices**
5. **Check Vercel function logs** for any errors

## Troubleshooting

### Common Issues

**1. "Invalid site key" error**
- Verify site key is correct in frontend code
- Check domain is added to reCAPTCHA console
- Ensure you're using the correct key for the environment

**2. CORS errors in browser**
- Check `vercel.json` has correct domain
- Verify domain exactly matches (include/exclude www)
- Test in incognito mode to rule out extensions

**3. "Invalid secret key" error**
- Verify secret key in Vercel environment variables
- Check environment variables are deployed: go to Vercel dashboard
- Ensure you're using the secret key (not site key)

**4. High false positive rate (legitimate users blocked)**
- Lower the score threshold in `api/verify-captcha.js`
- Monitor reCAPTCHA console for score distributions
- Consider switching to reCAPTCHA v2 if needed

**5. Function timeout errors**
- Check Vercel function logs
- Ensure Google reCAPTCHA API is responding
- Consider increasing maxDuration in `vercel.json`

### Debug Mode

**Enable detailed logging:**

```javascript
// Add to api/verify-captcha.js
console.log('Request body:', req.body);
console.log('reCAPTCHA response:', verificationResult);
console.log('Score:', score);
console.log('Action:', action, 'Returned:', returnedAction);
```

**View logs:**
- Vercel Dashboard → Project → Functions → View Logs
- Or use CLI: `vercel logs https://your-deployment-url.vercel.app`

### Monitoring

**Set up monitoring:**
1. **Vercel Analytics**: Monitor function performance
2. **Google reCAPTCHA Console**: Monitor CAPTCHA usage and scores
3. **Browser Console**: Check for JavaScript errors
4. **Shopify Analytics**: Monitor form submission rates

## Security Best Practices

### Environment Variables
- ✅ **Never commit** `.env.local` or any file with real keys
- ✅ **Use different keys** for development vs production
- ✅ **Rotate keys periodically** (every 6-12 months)
- ✅ **Limit domain access** in reCAPTCHA console

### CORS Configuration
- ✅ **Specify exact domains** instead of using `*`
- ✅ **Use HTTPS** for all production domains
- ✅ **Test cross-origin requests** thoroughly

### Function Security
- ✅ **Validate all inputs** before processing
- ✅ **Handle errors gracefully** without exposing internal details
- ✅ **Log security events** for monitoring
- ✅ **Keep dependencies updated**

## Performance Optimization

### Function Performance
- ✅ **Keep function code minimal** - only essential logic
- ✅ **Use async/await** efficiently
- ✅ **Handle timeouts gracefully**
- ✅ **Monitor execution time** in Vercel dashboard

### Frontend Performance
- ✅ **Load reCAPTCHA script async**
- ✅ **Show loading states** during verification
- ✅ **Implement proper error handling**
- ✅ **Cache reCAPTCHA token** if submitting multiple times

## Deployment Checklist

Before going live:

- [ ] **Test all form scenarios** (success, failure, network errors)
- [ ] **Verify environment variables** are set correctly
- [ ] **Update CORS settings** to production domain
- [ ] **Remove debug logging** from production code
- [ ] **Test on multiple browsers** and devices
- [ ] **Monitor function logs** during initial deployment
- [ ] **Set up monitoring alerts** for failures
- [ ] **Document any customizations** for client

## Support and Maintenance

### Regular Maintenance
- **Monthly**: Check Vercel and reCAPTCHA analytics
- **Quarterly**: Review and update score thresholds if needed
- **Annually**: Rotate reCAPTCHA keys

### Getting Help
- **Vercel Support**: [vercel.com/support](https://vercel.com/support)
- **reCAPTCHA Help**: [developers.google.com/recaptcha](https://developers.google.com/recaptcha)
- **Project Issues**: Use GitHub Issues for project-specific problems

### Useful Commands

```bash
# Check deployment status
vercel ls

# View recent logs
vercel logs

# Check environment variables
vercel env ls

# Force redeploy
git commit --allow-empty -m "Force redeploy"
git push origin main
```

## Additional Resources

- [Google reCAPTCHA Documentation](https://developers.google.com/recaptcha)
- [Vercel Functions Documentation](https://vercel.com/docs/functions)
- [Shopify Liquid Documentation](https://shopify.dev/docs/themes/liquid)
- [GitHub Actions for CI/CD](https://docs.github.com/en/actions) (for advanced workflows)