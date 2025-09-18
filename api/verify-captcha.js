export default async function handler(req, res) {
  // Define allowed origins
  const allowedOrigins = ['https://www.billyreid.com', 'http://127.0.0.1:9292'];

  const origin = req.headers.origin;

  // Set CORS headers dynamically
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  }

  try {
    // Validate environment variables
    if (!process.env.RECAPTCHA_SECRET_KEY) {
      console.error('RECAPTCHA_SECRET_KEY environment variable is not set');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
      });
    }

    const { token, action } = req.body;

    // Validate required fields
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'CAPTCHA token is required',
      });
    }

    // Verify with Google reCAPTCHA
    const verifyURL = 'https://www.google.com/recaptcha/api/siteverify';
    const verifyData = new URLSearchParams({
      secret: process.env.RECAPTCHA_SECRET_KEY,
      response: token,
      remoteip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    });

    const verificationResponse = await fetch(verifyURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: verifyData,
    });

    const verificationResult = await verificationResponse.json();
    const {
      success,
      score,
      action: returnedAction,
      'error-codes': errorCodes,
    } = verificationResult;

    // Log for debugging (remove in production)
    console.log('reCAPTCHA verification result:', verificationResult);

    // Check for errors
    if (errorCodes && errorCodes.length > 0) {
      console.error('reCAPTCHA errors:', errorCodes);
      return res.status(400).json({
        success: false,
        message: 'CAPTCHA verification failed due to configuration error',
      });
    }

    // For reCAPTCHA v3, check score (0.0 to 1.0, higher is more likely human)
    if (score !== undefined && score < 0.5) {
      return res.status(400).json({
        success: false,
        message: 'CAPTCHA verification failed - suspicious activity detected',
        score: score, // Optional: include score for debugging
      });
    }

    // For action-based verification (reCAPTCHA v3)
    if (action && returnedAction !== action) {
      return res.status(400).json({
        success: false,
        message: 'CAPTCHA action mismatch',
      });
    }

    if (success) {
      // Add your custom logic here
      // e.g., save form data, send emails, etc.

      res.json({
        success: true,
        message: 'CAPTCHA verified successfully',
        ...(score && { score }), // Include score in response for v3
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'CAPTCHA verification failed',
      });
    }
  } catch (error) {
    console.error('CAPTCHA verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during CAPTCHA verification',
    });
  }
}
