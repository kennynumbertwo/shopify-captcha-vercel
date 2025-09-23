async function fetchMetaobjects() {}

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

    if (
      !process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ||
      !process.env.SHOPIFY_SHOP_DOMAIN
    ) {
      console.error('Shopify Admin API credentials not configured');
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
      // CAPTCHA verified - now fetch booking data from Shopify Admin API
      try {
        const bookingData = await fetchAllMetaobjects();

        res.json({
          success: true,
          message: 'CAPTCHA verified successfully',
          data: bookingData,
          ...(score && { score }),
        });
      } catch (shopifyError) {
        console.error('Shopify API error:', shopifyError);
        res.status(500).json({
          success: false,
          message: 'Failed to fetch booking data',
        });
      }
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

  // Helper function to fetch all metaobjects in a single query
  async function fetchAllMetaobjects() {
    const query = `
      query ShopMetaobjects {
        customLocations: metaobjects(first: 100, type: "custom_location") {
          edges {
            node {
              id
              handle
              displayName
              fields {
                key
                value
              }
            }
          }
        }
        stylists: metaobjects(first: 100, type: "stylist") {
          edges {
            node {
              id
              handle
              displayName
              fields {
                key
                value
              }
            }
          }
        }
      }
    `;

    const response = await fetch(
      `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2024-10/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
        },
        body: JSON.stringify({ query }),
      }
    );

    if (!response.ok) {
      throw new Error(`Shopify API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(`Shopify API errors: ${JSON.stringify(data.errors)}`);
    }

    // Transform data to the desired format
    const locations = {};
    const stylists = {};

    // Process custom locations
    data.data.customLocations.edges.forEach(({ node }) => {
      const bookingField = node.fields.find(
        (field) => field.key === 'booking_link'
      );
      if (bookingField?.value) {
        locations[node.handle] = bookingField.value;
      }
    });

    // Process stylists
    data.data.stylists.edges.forEach(({ node }) => {
      const bookingField = node.fields.find(
        (field) => field.key === 'booking_link'
      );
      if (bookingField?.value) {
        stylists[node.handle] = bookingField.value;
      }
    });

    return {
      locations,
      stylists,
    };
  }
}
