'use client';

import Link from 'next/link';

export default function Features() {
  return (
    <div className="min-h-screen" style={{ background: '#FAF9F6' }}>
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="mb-8">
          <Link 
            href="/"
            className="text-[#FC4C02] hover:opacity-80 uppercase tracking-wider text-sm mb-6 inline-block"
          >
            ← BACK TO RECEIPTS
          </Link>
          <h1 className="text-3xl font-bold uppercase tracking-wider mb-8">
            FEATURES & CHANGELOG
          </h1>
        </div>

        {/* Features Breakdown */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold uppercase tracking-wider mb-6 text-[#FC4C02]">
            FEATURES
          </h2>
          
          <div className="space-y-8">
            {/* Single Activity View */}
            <div>
              <h3 className="text-lg font-bold uppercase tracking-wider mb-3">
                SINGLE ACTIVITY VIEW
              </h3>
              <ul className="space-y-2 text-sm leading-relaxed uppercase tracking-wider text-[#666] list-disc list-inside">
                <li>View individual activities as receipt-style summaries</li>
                <li>Display activity name, location, and date</li>
                <li>Show distance, pace/speed, heart rate, elevation gain</li>
                <li>Display gear information and achievements (PRs/KOMs)</li>
                <li>GPS route visualization as route signature</li>
                <li>Activity photos with dithering option for thermal printing</li>
                <li>QR code linking to Strava activity</li>
                <li>Customizable footer text</li>
                <li>Toggle activity name on line items</li>
              </ul>
            </div>

            {/* Summary View */}
            <div>
              <h3 className="text-lg font-bold uppercase tracking-wider mb-3">
                SUMMARY VIEW
              </h3>
              <ul className="space-y-2 text-sm leading-relaxed uppercase tracking-wider text-[#666] list-disc list-inside">
                <li>Automatic aggregation by time period (week, month, 3 months, YTD, 12 months, all time, custom range)</li>
                <li>Filter by distance-based activities or all activities</li>
                <li>Group activities by type with totals</li>
                <li>Combined route visualization showing all routes</li>
                <li>Total distance and time calculations</li>
                <li>Activity count display</li>
              </ul>
            </div>

            {/* Manual Selection View */}
            <div>
              <h3 className="text-lg font-bold uppercase tracking-wider mb-3">
                MANUAL SELECTION VIEW
              </h3>
              <ul className="space-y-2 text-sm leading-relaxed uppercase tracking-wider text-[#666] list-disc list-inside">
                <li>Manually select up to 20 activities from sidebar</li>
                <li>Toggle activities on/off with checkboxes</li>
                <li>Two modes: Aggregate or Sequence</li>
                <li><strong>Aggregate Mode:</strong> Combine activities with totals (e.g., 10 runs over days)</li>
                <li><strong>Sequence Mode:</strong> Show activities in chronological order as one event (e.g., triathlon: swim → bike → run)</li>
                <li>Automatic location detection for sequenced activities in same city</li>
                <li>Spatially aligned route visualization for sequenced activities</li>
                <li>Activity names shown in sequence order</li>
              </ul>
            </div>

            {/* Customization Options */}
            <div>
              <h3 className="text-lg font-bold uppercase tracking-wider mb-3">
                CUSTOMIZATION OPTIONS
              </h3>
              <ul className="space-y-2 text-sm leading-relaxed uppercase tracking-wider text-[#666] list-disc list-inside">
                <li>Units: Miles or Kilometers</li>
                <li>Show/hide location, description, photos, QR code</li>
                <li>Pace format: Min/Mile or Min/KM, or Speed (MPH/KPH)</li>
                <li>Photo layout: 1 column or 2x2 grid</li>
                <li>Photo dithering for thermal printer aesthetic</li>
                <li>Select specific photos to include</li>
                <li>Show/hide route visualization</li>
                <li>Show/hide activity name on line items</li>
                <li>Custom footer text</li>
              </ul>
            </div>

            {/* Export & Share */}
            <div>
              <h3 className="text-lg font-bold uppercase tracking-wider mb-3">
                EXPORT & SHARE
              </h3>
              <ul className="space-y-2 text-sm leading-relaxed uppercase tracking-wider text-[#666] list-disc list-inside">
                <li>Download receipt as PNG image</li>
                <li>Share/save to device (mobile share sheet)</li>
                <li>High-resolution export (2x pixel ratio)</li>
                <li>Optimized for thermal receipt printers</li>
              </ul>
            </div>

            {/* Activity Management */}
            <div>
              <h3 className="text-lg font-bold uppercase tracking-wider mb-3">
                ACTIVITY MANAGEMENT
              </h3>
              <ul className="space-y-2 text-sm leading-relaxed uppercase tracking-wider text-[#666] list-disc list-inside">
                <li>Filter activities by type (All, Run, Ride, Walk, Hike, Swim, etc.)</li>
                <li>Sort by date (newest/oldest), distance (highest/lowest), or type</li>
                <li>Pagination for large activity lists</li>
                <li>Load more activities or load all at once</li>
                <li>Activity caching for faster loading</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Changelog */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold uppercase tracking-wider mb-6 text-[#FC4C02]">
            CHANGELOG
          </h2>
          
          <div className="space-y-8">
            {/* Latest */}
            <div>
              <h3 className="text-lg font-bold uppercase tracking-wider mb-3">
                LATEST UPDATES
              </h3>
              <div className="space-y-4 text-sm leading-relaxed uppercase tracking-wider text-[#666]">
                <div>
                  <p className="font-bold text-[#FC4C02] mb-1">ACTIVITY NAME OPTION</p>
                  <p>Added toggle to show activity names on receipt line items in single, aggregate, and sequence views</p>
                </div>
                <div>
                  <p className="font-bold text-[#FC4C02] mb-1">MANUAL SELECTION MODE</p>
                  <p>Added manual selection mode with aggregate and sequence options. Select up to 20 activities and combine them with location detection for sequenced activities</p>
                </div>
                <div>
                  <p className="font-bold text-[#FC4C02] mb-1">SEQUENCE VS AGGREGATE</p>
                  <p>Added distinction between sequence mode (activities as one event, like triathlons) and aggregate mode (combine totals). Routes are spatially aligned in sequence mode</p>
                </div>
              </div>
            </div>

            {/* Previous Updates */}
            <div>
              <h3 className="text-lg font-bold uppercase tracking-wider mb-3">
                PREVIOUS UPDATES
              </h3>
              <div className="space-y-4 text-sm leading-relaxed uppercase tracking-wider text-[#666]">
                <div>
                  <p className="font-bold text-[#FC4C02] mb-1">SUMMARY VIEW</p>
                  <p>Added automatic summary view with time period filters and activity aggregation</p>
                </div>
                <div>
                  <p className="font-bold text-[#FC4C02] mb-1">ROUTE VISUALIZATION</p>
                  <p>Added GPS route visualization as route signatures on receipts</p>
                </div>
                <div>
                  <p className="font-bold text-[#FC4C02] mb-1">PHOTO SUPPORT</p>
                  <p>Added activity photo display with dithering option for thermal printer aesthetic</p>
                </div>
                <div>
                  <p className="font-bold text-[#FC4C02] mb-1">CUSTOMIZATION</p>
                  <p>Added extensive customization options for receipt appearance</p>
                </div>
                <div>
                  <p className="font-bold text-[#FC4C02] mb-1">EXPORT & SHARE</p>
                  <p>Added download and share functionality for receipt images</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div className="flex items-center gap-4 mb-6">
          <a
            href="https://www.instagram.com/_re_pete"
            target="_blank"
            rel="noopener noreferrer"
            className="social-link"
            title="Instagram"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </a>
          <a
            href="https://www.tiktok.com/@_re_pete"
            target="_blank"
            rel="noopener noreferrer"
            className="social-link"
            title="TikTok"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
            </svg>
          </a>
          <a
            href="https://twitter.com/_re_pete"
            target="_blank"
            rel="noopener noreferrer"
            className="social-link"
            title="Twitter"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
            </svg>
          </a>
          <a
            href="https://www.strava.com/athletes/63762822"
            target="_blank"
            rel="noopener noreferrer"
            className="social-link"
            title="Strava"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.599h4.172L10.463 0l-7.007 13.828h4.169"/>
            </svg>
          </a>
        </div>

        {/* Buy Me a Coffee Button */}
        <div className="mb-8">
          <a
            href="https://www.buymeacoffee.com/repete"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs uppercase tracking-wider py-3 px-6 border-2 border-[#FC4C02] text-[#FC4C02] hover:bg-[#FC4C02] hover:text-white transition inline-block"
          >
            ☕ BUY ME A COFFEE
          </a>
        </div>

        {/* Footer */}
        <div className="pt-8 border-t border-[#DDD]">
          <p className="text-[10px] text-[#999] uppercase tracking-wider">
            <Link href="https://repete.art" className="hover:text-[#FC4C02]">
              BUILT WITH LOVE BY PETE :D
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

