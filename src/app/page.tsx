'use client';

/**
 * Strava Receipt Generator
 * 
 * Main application component that connects to Strava API, fetches activity data,
 * and renders activities as receipt-style summaries. Supports download, share,
 * and print functionality for physical receipt printers.
 * 
 * Key features:
 * - OAuth authentication with Strava
 * - Activity data fetching and caching
 * - Receipt-style rendering with GPS routes and photos
 * - Download/share receipt as PNG
 * - Print to thermal printer (button only visible on localhost)
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { toPng } from 'html-to-image';
import { 
  StravaActivity, 
  StravaPhoto, 
  RoutePoint,
  formatDistance, 
  formatDuration, 
  calculatePace,
  formatDateLong,
  activitySupportsGPS,
  reverseGeocode,
  STRAVA_API_BASE
} from '@/lib/strava';

const STRAVA_CLIENT_ID = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID || '84942';

const getAppUrl = () => {
  const url = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return url.startsWith('http') ? url : `https://${url}`;
};
const APP_URL = getAppUrl();

const getActivitiesPerPage = () => {
  if (typeof window !== 'undefined') {
    return window.innerWidth < 1024 ? 3 : 20;
  }
  return 20;
};

const ACTIVITY_TYPES = ['All', 'Run', 'Ride', 'Walk', 'Hike', 'Swim', 'WeightTraining', 'Workout'] as const;

const ACTIVITIES_CACHE_KEY = 'strava_activities_cache';
const ACTIVITIES_CACHE_TIMESTAMP_KEY = 'strava_activities_cache_timestamp';
const ACTIVITIES_COUNT_KEY = 'strava_activities_count';
const CACHE_EXPIRY_MS = 60 * 60 * 1000;
const getCachedActivities = (): StravaActivity[] | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(ACTIVITIES_CACHE_KEY);
    const timestamp = localStorage.getItem(ACTIVITIES_CACHE_TIMESTAMP_KEY);
    
    if (!cached || !timestamp) return null;
    
    const cacheTime = parseInt(timestamp, 10);
    const now = Date.now();
    if (now - cacheTime > CACHE_EXPIRY_MS) {
      clearActivitiesCache();
      return null;
    }
    
    return JSON.parse(cached) as StravaActivity[];
  } catch (err) {
    console.error('Error reading activities cache:', err);
    return null;
  }
};

const setCachedActivities = (activities: StravaActivity[], count: number) => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(ACTIVITIES_CACHE_KEY, JSON.stringify(activities));
    localStorage.setItem(ACTIVITIES_CACHE_TIMESTAMP_KEY, Date.now().toString());
    localStorage.setItem(ACTIVITIES_COUNT_KEY, count.toString());
  } catch (err) {
    console.error('Error saving activities cache:', err);
  }
};

const clearActivitiesCache = () => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(ACTIVITIES_CACHE_KEY);
    localStorage.removeItem(ACTIVITIES_CACHE_TIMESTAMP_KEY);
    localStorage.removeItem(ACTIVITIES_COUNT_KEY);
  } catch (err) {
    console.error('Error clearing activities cache:', err);
  }
};

const getCachedActivitiesCount = (): number => {
  if (typeof window === 'undefined') return 0;
  
  try {
    const count = localStorage.getItem(ACTIVITIES_COUNT_KEY);
    return count ? parseInt(count, 10) : 0;
  } catch {
    return 0;
  }
};

export default function Home() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [allActivities, setAllActivities] = useState<StravaActivity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<StravaActivity | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RoutePoint[] | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<StravaPhoto[] | null>(null);
  const [selectedPhotoIndices, setSelectedPhotoIndices] = useState<Set<number>>(new Set());
  const [photoLoadStates, setPhotoLoadStates] = useState<Map<string, 'loading' | 'loaded' | 'error'>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [imageLoadingProgress, setImageLoadingProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showLocation, setShowLocation] = useState<boolean>(true);
  const [showDescription, setShowDescription] = useState<boolean>(true);
  const [showPhotos, setShowPhotos] = useState<boolean>(true);
  const [enableDithering, setEnableDithering] = useState<boolean>(true);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [showQRCode, setShowQRCode] = useState<boolean>(true);
  const [showRoute, setShowRoute] = useState<boolean>(true);
  const [showPace, setShowPace] = useState<boolean>(true);
  const [showHeartRate, setShowHeartRate] = useState<boolean>(true);
  const [showElevation, setShowElevation] = useState<boolean>(true);
  const [showGear, setShowGear] = useState<boolean>(true);
  const [showAchievements, setShowAchievements] = useState<boolean>(true);
  const [photoLayout, setPhotoLayout] = useState<'1col' | '2x2'>('1col');
  const [athleteCopyText, setAthleteCopyText] = useState<string>('ATHLETE COPY');
  const [units, setUnits] = useState<'miles' | 'km'>('miles');
  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);
  const [isLocalhost, setIsLocalhost] = useState<boolean>(false);

  useEffect(() => {
    if (selectedActivity) {
      if (!selectedActivity.average_heartrate) {
        setShowHeartRate(false);
      }
      if (!selectedActivity.gear?.nickname && !selectedActivity.gear?.name) {
        setShowGear(false);
      }
      const hasAchievements = (selectedActivity.achievements && selectedActivity.achievements.length > 0) ||
                              (selectedActivity.pr_count && selectedActivity.pr_count > 0) ||
                              (selectedActivity.achievement_count && selectedActivity.achievement_count > 0);
      if (!hasAchievements) {
        setShowAchievements(false);
      }
    }
  }, [selectedActivity]);
  const [showSupportModal, setShowSupportModal] = useState<boolean>(false);
  const [hasShownSupportModal, setHasShownSupportModal] = useState<boolean>(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [filterType, setFilterType] = useState<string>('All');
  const [sortOrder, setSortOrder] = useState<string>('date-desc');
  const [totalActivitiesLoaded, setTotalActivitiesLoaded] = useState(0);
  const [hasMoreActivities, setHasMoreActivities] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const receiptRef = useRef<HTMLDivElement>(null);
  const photoImageRefs = useRef<{ [key: string]: HTMLImageElement }>({});

  const photoUrls = useMemo(() => {
    if (!selectedPhotos || !selectedActivity) {
      if (process.env.NODE_ENV === 'development') {
        console.log('photoUrls: No photos or activity', { hasPhotos: !!selectedPhotos, hasActivity: !!selectedActivity });
      }
      return new Map<string, string>();
    }
    
    const urls = new Map<string, string>();
    const activityId = selectedActivity.id || 'activity';
    const seenOriginalUrls = new Set<string>();
    
    selectedPhotos.forEach((photo, index) => {
      if (!photo.unique_id) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Photo ${index} missing unique_id:`, photo);
        }
        return;
      }
      
      const photoUrl = photo.urls?.['600'] || photo.urls?.['100'];
      if (!photoUrl) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Photo ${index} (${photo.unique_id}) missing URL`);
        }
        return;
      }
      
      if (seenOriginalUrls.has(photoUrl)) {
        console.error(`⚠️ DUPLICATE original URL detected for photo ${index} (${photo.unique_id}) - SKIPPING URL generation`);
        return;
      }
      seenOriginalUrls.add(photoUrl);
      
      const urlHash = photoUrl.split('/').pop() || photoUrl.substring(photoUrl.length - 20);
      const uniqueId = `${activityId}-${photo.unique_id}-${index}`;
      const proxiedUrl = `/api/proxy-image?url=${encodeURIComponent(photoUrl)}&photoId=${photo.unique_id}&activityId=${activityId}&idx=${index}&hash=${urlHash}`;
      
      urls.set(uniqueId, proxiedUrl);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`Generated URL for photo ${index}: uniqueId=${uniqueId}, originalUrl=${photoUrl.substring(0, 50)}...`);
      }
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📸 Generated ${urls.size} photo URLs for activity ${activityId}`);
    }
    
    return urls;
  }, [selectedPhotos, selectedActivity?.id]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsLocalhost(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      
      if (params.get('access_token')) {
        const token = params.get('access_token')!;
        const refresh = params.get('refresh_token')!;
        setAccessToken(token);
        setRefreshToken(refresh);
        localStorage.setItem('strava_access_token', token);
        localStorage.setItem('strava_refresh_token', refresh);
        window.history.replaceState(null, '', window.location.pathname);
      } else {
        const storedToken = localStorage.getItem('strava_access_token');
        const storedRefresh = localStorage.getItem('strava_refresh_token');
        if (storedToken) {
          setAccessToken(storedToken);
          setRefreshToken(storedRefresh);
        }
      }

      const urlParams = new URLSearchParams(window.location.search);
      const urlError = urlParams.get('error');
      if (urlError) {
        setError(`Authentication error: ${urlError}`);
      }
    }
  }, []);

  useEffect(() => {
    if (accessToken) {
      const cached = getCachedActivities();
      if (cached && cached.length > 0) {
        setAllActivities(cached);
        setTotalActivitiesLoaded(getCachedActivitiesCount());
        fetchActivities(1, true, true);
      } else {
        fetchActivities(1, true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    if (allActivities.length > 0 && !selectedActivity) {
      const timer = setTimeout(() => {
        selectActivity(allActivities[0]);
      }, 100);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allActivities.length, selectedActivity]);

  // Fetch activities from Strava API with caching and pagination
  const fetchActivities = async (page: number = 1, reset: boolean = false, silent: boolean = false) => {
    if (!accessToken) return;
    
    if (reset && !silent) {
      setIsLoading(true);
    } else if (!silent) {
      setIsLoadingMore(true);
    }
    
    try {
      const response = await fetch(
        `${STRAVA_API_BASE}/athlete/activities?per_page=100&page=${page}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      
      if (response.status === 401) {
        await handleTokenRefresh();
        return;
      }
      
      if (response.status === 429) {
        setError('Hey! This application has gotten rate-limited due to its popularity! Please check back in another time.');
        return;
      }
      
      if (!response.ok) throw new Error('Failed to fetch activities');
      
      const data: StravaActivity[] = await response.json();
      
      if (reset && page === 1) {
        const cached = getCachedActivities();
        if (cached && cached.length > 0) {
          const cachedIds = new Set(cached.map(a => a.id));
          const newActivities = data.filter(a => !cachedIds.has(a.id));
          
          if (newActivities.length > 0) {
            const merged = [...newActivities, ...cached];
            setAllActivities(merged);
            setTotalActivitiesLoaded(merged.length);
            setCachedActivities(merged, merged.length);
          } else {
            setAllActivities(cached);
            setTotalActivitiesLoaded(getCachedActivitiesCount());
          }
        } else {
          setAllActivities(data);
          setTotalActivitiesLoaded(data.length);
          setCachedActivities(data, data.length);
        }
        
        if (data.length > 0 && !selectedActivity) {
          selectActivity(data[0]);
        }
      } else if (reset) {
        setAllActivities(data);
        setTotalActivitiesLoaded(data.length);
        setCachedActivities(data, data.length);
        if (data.length > 0 && !selectedActivity) {
          selectActivity(data[0]);
        }
      } else {
        setAllActivities(prev => {
          const updated = [...prev, ...data];
          setCachedActivities(updated, updated.length);
          return updated;
        });
        setTotalActivitiesLoaded(prev => prev + data.length);
      }
      
      setHasMoreActivities(data.length === 100);
    } catch (err) {
      if (!silent) {
        setError('Failed to load activities');
        console.error(err);
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  };

  const loadMoreActivities = () => {
    const nextPage = Math.ceil(totalActivitiesLoaded / 100) + 1;
    fetchActivities(nextPage, false);
  };

  const loadAllActivities = async () => {
    if (!accessToken) return;
    
    clearActivitiesCache();
    setIsLoadingMore(true);
    
    let page = 1;
    let hasMore = true;
    let allFetchedActivities: StravaActivity[] = [];
    
    while (hasMore) {
      try {
        const response = await fetch(
          `${STRAVA_API_BASE}/athlete/activities?per_page=100&page=${page}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        
        if (response.status === 401) {
          await handleTokenRefresh();
          break;
        }
        
        if (response.status === 429) {
          setError('Hey! This application has gotten rate-limited due to its popularity! Please check back in another time.');
          break;
        }
        
        if (!response.ok) break;
        
        const data: StravaActivity[] = await response.json();
        if (data.length === 0) {
          hasMore = false;
        } else {
          allFetchedActivities = [...allFetchedActivities, ...data];
          setAllActivities(allFetchedActivities);
          setTotalActivitiesLoaded(allFetchedActivities.length);
          page++;
          hasMore = data.length === 100;
        }
      } catch {
        break;
      }
    }
    
    setCachedActivities(allFetchedActivities, allFetchedActivities.length);
    
    setHasMoreActivities(false);
    setIsLoadingMore(false);
  };

  const handleTokenRefresh = async () => {
    if (!refreshToken) {
      handleLogout();
      return;
    }
    
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      
      if (response.status === 429) {
        setError('Hey! This application has gotten rate-limited due to its popularity! Please check back in another time.');
        return;
      }
      
      if (!response.ok) {
        handleLogout();
        return;
      }
      
      const data = await response.json();
      setAccessToken(data.access_token);
      if (data.refresh_token) {
        setRefreshToken(data.refresh_token);
        localStorage.setItem('strava_refresh_token', data.refresh_token);
      }
      localStorage.setItem('strava_access_token', data.access_token);
    } catch {
      handleLogout();
    }
  };

  const selectActivity = async (activity: StravaActivity) => {
    setSelectedRoute(null);
    setSelectedPhotos(null);
    setSelectedPhotoIndices(new Set());
    
    console.log('🏃 Selected Activity (initial):', activity);
    
    const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
      let currentToken = accessToken;
      
      const makeRequest = async (token: string): Promise<Response> => {
        if (!token) {
          const storedToken = localStorage.getItem('strava_access_token');
          if (storedToken) {
            token = storedToken;
            currentToken = storedToken;
          } else {
            throw new Error('No access token available');
          }
        }
        
        const response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${token}`
          }
        });
        
        if (response.status === 401) {
          await handleTokenRefresh();
          await new Promise(resolve => setTimeout(resolve, 100));
          const newToken = localStorage.getItem('strava_access_token');
          if (newToken && newToken !== token) {
            currentToken = newToken;
            setAccessToken(newToken);
            return await fetch(url, {
              ...options,
              headers: {
                ...options.headers,
                Authorization: `Bearer ${newToken}`
              }
            });
          } else {
            throw new Error('Authentication failed - please log in again');
          }
        }
        
        return response;
      };
      
      return await makeRequest(currentToken || '');
    };
    
    let activityWithLocation = activity;
    try {
      const response = await fetchWithAuth(
        `${STRAVA_API_BASE}/activities/${activity.id}`
      );
      if (response.status === 429) {
        setError('Hey! This application has gotten rate-limited due to its popularity! Please check back in another time.');
        return;
      }
      if (response.ok) {
        const detailedActivity = await response.json();
        
        console.log('📋 Detailed Activity (from API):', detailedActivity);
        console.log('🏆 Achievements:', detailedActivity.achievements);
        console.log('📊 PR Count:', detailedActivity.pr_count);
        console.log('🎯 Achievement Count:', detailedActivity.achievement_count);
        console.log('🔧 Gear:', detailedActivity.gear);
        console.log('🔧 Gear ID:', detailedActivity.gear_id);
        
        const gearNickname = detailedActivity.gear?.nickname || detailedActivity.gear?.name || null;
        const achievements = detailedActivity.achievements || null;
        const prCount = detailedActivity.pr_count || 0;
        const achievementCount = detailedActivity.achievement_count || 0;
        const description = detailedActivity.description || null;
        
        activityWithLocation = {
          ...activity,
          location_city: activity.location_city || detailedActivity.location_city || null,
          location_state: activity.location_state || detailedActivity.location_state || null,
          location_country: activity.location_country || detailedActivity.location_country || null,
          start_latlng: detailedActivity.start_latlng || activity.start_latlng || null,
          device_name: detailedActivity.device_name || activity.device_name || null,
          gear_id: detailedActivity.gear_id || activity.gear_id || null,
          gear: gearNickname ? { 
            id: detailedActivity.gear_id || '', 
            name: detailedActivity.gear?.name || gearNickname,
            nickname: detailedActivity.gear?.nickname || null
          } : null,
          description: description,
          achievements: achievements,
          pr_count: prCount,
          achievement_count: achievementCount
        };
        
        console.log('✅ Final Activity Object:', activityWithLocation);
        console.log('🏆 Final Achievements:', activityWithLocation.achievements);
        console.log('📊 Final PR Count:', activityWithLocation.pr_count);
        console.log('🎯 Final Achievement Count:', activityWithLocation.achievement_count);
        
        if (!activityWithLocation.location_city && activityWithLocation.start_latlng && activityWithLocation.start_latlng.length === 2) {
          const [lat, lng] = activityWithLocation.start_latlng;
          const geoLocation = await reverseGeocode(lat, lng);
          if (geoLocation) {
            activityWithLocation.location_city = geoLocation.city || null;
            activityWithLocation.location_state = geoLocation.state || null;
            activityWithLocation.location_country = geoLocation.country || null;
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch detailed activity:', err);
    }
    
    setSelectedActivity(activityWithLocation);
    
    if (activitySupportsGPS(activity.type)) {
      try {
        const response = await fetchWithAuth(
          `${STRAVA_API_BASE}/activities/${activity.id}/streams?keys=latlng&key_by_type=true`
        );
        if (response.status === 429) {
          setError('Hey! This application has gotten rate-limited due to its popularity! Please check back in another time.');
          return;
        }
        if (response.ok) {
          const data = await response.json();
          if (data.latlng?.data) {
            setSelectedRoute(data.latlng.data.map((p: number[]) => ({ lat: p[0], lng: p[1] })));
          }
        }
      } catch (err) {
        console.error('Failed to fetch route:', err);
      }
    }
    
    try {
      const response = await fetchWithAuth(
        `${STRAVA_API_BASE}/activities/${activity.id}/photos?size=600`
      );
      if (response.status === 429) {
        setError('Hey! This application has gotten rate-limited due to its popularity! Please check back in another time.');
        return;
      }
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          console.log(`📷 Fetched ${data.length} photos for activity ${activity.id}`);

          const uniqueIds = new Set<string>();
          const photoUrls = new Set<string>();
          const seenPhotos = new Map<string, number>(); // Map URL to index
          const filteredPhotos: StravaPhoto[] = [];
          
          data.forEach((photo: StravaPhoto, idx: number) => {
            const photoUrl = photo.urls?.['600'] || photo.urls?.['100'];
            
            if (!photo.unique_id || !photoUrl) {
              console.warn(`⚠️ Photo ${idx} missing unique_id or URL, skipping`);
              return;
            }

            if (uniqueIds.has(photo.unique_id)) {
              console.error(`  ⚠️ DUPLICATE unique_id at index ${idx}: ${photo.unique_id} - SKIPPING`);
              return;
            }

            if (photoUrls.has(photoUrl)) {
              const existingIdx = seenPhotos.get(photoUrl);
              console.error(`  ⚠️ DUPLICATE URL at index ${idx} (same as index ${existingIdx}): ${photoUrl.substring(0, 60)}... - SKIPPING`);
              return;
            }

            uniqueIds.add(photo.unique_id);
            photoUrls.add(photoUrl);
            seenPhotos.set(photoUrl, idx);
            filteredPhotos.push(photo);
          });
          
          if (filteredPhotos.length !== data.length) {
            console.warn(`⚠️ Filtered out ${data.length - filteredPhotos.length} duplicate photos. Using ${filteredPhotos.length} unique photos.`);
          } else {
            console.log(`✅ All ${filteredPhotos.length} photos are unique`);
          }
          
          setSelectedPhotos(filteredPhotos);

          setSelectedPhotoIndices(new Set(filteredPhotos.map((_, idx) => idx)));

          setPhotoLoadStates(new Map());
        }
      }
    } catch (err) {
      console.error('Failed to fetch photos:', err);
    }
  };

  const handleLogin = () => {
    const authUrl = new URL('https://www.strava.com/oauth/authorize');
    authUrl.searchParams.set('client_id', STRAVA_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', `${APP_URL}/api/auth/callback`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'activity:read_all');
    window.location.href = authUrl.toString();
  };

  const handleLogout = () => {
    setAccessToken(null);
    setRefreshToken(null);
    setAllActivities([]);
    setSelectedActivity(null);
    localStorage.removeItem('strava_access_token');
    localStorage.removeItem('strava_refresh_token');
    clearActivitiesCache(); // Clear activities cache on logout
  };

  const waitForImageDecode = (img: HTMLImageElement): Promise<void> => {
    return new Promise((resolve) => {
      // First check if image is already fully loaded and decoded
      if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {

        if (img.decode) {
          img.decode().then(() => resolve()).catch(() => resolve());
        } else {
          resolve();
        }
        return;
      }

      let resolved = false;
      const finish = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };
      
      // Try decode() if available
      if (img.decode) {
        img.decode().then(() => {

          if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
            finish();
          } else {

            img.onload = finish;
            img.onerror = finish;
          }
        }).catch(() => {

          img.onload = finish;
          img.onerror = finish;
        });
      } else {

        img.onload = finish;
        img.onerror = finish;
      }

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, 10000);
    });
  };

  const waitForPaint = (): Promise<void> => {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });
    });
  };

  const imageToDataUrl = async (img: HTMLImageElement): Promise<string> => {
    return new Promise((resolve, reject) => {

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);

      try {
        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrl);
      } catch (err) {
        reject(err);
      }
    });
  };

  const waitForImagesToLoad = async (images: NodeListOf<HTMLImageElement>): Promise<void> => {
    const loadPromises = Array.from(images).map((img) => {
      return new Promise<void>((resolve) => {
        if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
          resolve();
          return;
        }
        
        const onLoad = () => {
          img.removeEventListener('load', onLoad);
          img.removeEventListener('error', onError);
          resolve();
        };
        
        const onError = () => {
          img.removeEventListener('load', onLoad);
          img.removeEventListener('error', onError);
          resolve(); // Resolve even on error
        };
        
        img.addEventListener('load', onLoad);
        img.addEventListener('error', onError);

        setTimeout(() => {
          img.removeEventListener('load', onLoad);
          img.removeEventListener('error', onError);
          resolve();
        }, 10000);
      });
    });
    
    await Promise.all(loadPromises);
  };

  const shouldHaveImages = (): boolean => {

    const hasQrCode = Boolean(showQRCode);
    const hasRoute = Boolean(showRoute && selectedRoute && selectedRoute.length > 0);
    const hasPhotos = Boolean(showPhotos && selectedPhotos && selectedPhotos.length > 0);
    
    // If any images should be present, return true
    return hasQrCode || hasRoute || hasPhotos;
  };

  const getDataUrlSize = (dataUrl: string): number => {
    // Remove data URL prefix (e.g., "data:image/png;base64,")
    const base64String = dataUrl.split(',')[1] || '';
    // Calculate approximate size: base64 is ~4/3 of original binary size
    // But since we want the actual data URL size, we use base64 length directly
    // Base64 encoding: each 4 chars = 3 bytes
    return (base64String.length * 3) / 4;
  };

  const performDownload = async (isRetry: boolean = false, shouldDownload: boolean = true): Promise<{ success: boolean; dataUrl: string | null }> => {
    if (!receiptRef.current || !selectedActivity) return { success: false, dataUrl: null };

    const allImages = receiptRef.current.querySelectorAll('img') as NodeListOf<HTMLImageElement>;
    const originalSrcs = new Map<HTMLImageElement, string>();
    
    try {
      if (!isRetry || !shouldDownload) {
        // First attempt or not downloading - just show "Preparing"
        setImageLoadingProgress('Preparing...');
      }

      if (shouldDownload) {
        setImageLoadingProgress(`Waiting for images to load (0/${allImages.length})...`);
      }
      await waitForImagesToLoad(allImages);
      await waitForPaint();
      await new Promise(resolve => setTimeout(resolve, isRetry ? 1000 : 500)); // Longer wait on retry

      if (shouldDownload) {
        setImageLoadingProgress('Converting images...');
      }
      const conversionPromises: Promise<void>[] = [];
      
      let convertedCount = 0;
      for (const img of Array.from(allImages)) {
        if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {

          originalSrcs.set(img, img.src);

          conversionPromises.push(
            imageToDataUrl(img)
              .then((dataUrl) => {
                img.src = dataUrl;
                if (shouldDownload) {
                  convertedCount++;
                  setImageLoadingProgress(`Converting images (${convertedCount}/${allImages.length})...`);
                }
              })
              .catch((err) => {
                console.error('Failed to convert image to data URL:', err);
                if (shouldDownload) {
                  convertedCount++;
                  setImageLoadingProgress(`Converting images (${convertedCount}/${allImages.length})...`);
                }
              })
          );
        }
      }
      
      await Promise.all(conversionPromises);
      await waitForPaint();
      await new Promise(resolve => setTimeout(resolve, isRetry ? 500 : 200)); // Longer wait on retry

      if (shouldDownload) {
        setImageLoadingProgress('Finalizing image...');
      }
      const dataUrl = await toPng(receiptRef.current, {
        backgroundColor: '#FAF9F6',
        pixelRatio: 2,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      
      if (!dataUrl) {
        throw new Error('Failed to generate image');
      }

      for (const [img, originalSrc] of originalSrcs.entries()) {
        img.src = originalSrc;
      }

      if (shouldDownload) {
        const link = document.createElement('a');
        link.download = `strava-receipt-${selectedActivity.name.replace(/\s+/g, '-').toLowerCase()}.png`;
        link.href = dataUrl;
        link.click();
      }
      
      return { success: true, dataUrl }; // Return success and dataUrl
    } catch (err) {
      console.error('Failed to download:', err);

      for (const [img, originalSrc] of originalSrcs.entries()) {
        img.src = originalSrc;
      }
      return { success: false, dataUrl: null }; // Failed
    }
  };

  // Download receipt as PNG - always run twice (second attempt always works)
  const handleDownload = async () => {
    if (!receiptRef.current || !selectedActivity) return;
    
    setIsDownloading(true);
    
    try {
      // First attempt - prepare only, don't download
      await performDownload(false, false);
      
      // Second attempt - actually download (this always works)
      setImageLoadingProgress('Finalizing...');
      await new Promise(resolve => setTimeout(resolve, 300));
      await performDownload(true, true);
      
      // Show support modal after download
      if (!hasShownSupportModal) {
        setHasShownSupportModal(true);
        setShowSupportModal(true);
      }
    } catch (err) {
      // Silently ignore errors - second attempt will work
      console.error('Download attempt failed (will retry):', err);
    } finally {
      setIsDownloading(false);
      setImageLoadingProgress('');
    }
  };

  const performShare = async (isRetry: boolean = false, shouldShare: boolean = true): Promise<{ success: boolean; dataUrl: string | null }> => {
    if (!receiptRef.current || !selectedActivity) return { success: false, dataUrl: null };

    const allImagesShare = receiptRef.current.querySelectorAll('img') as NodeListOf<HTMLImageElement>;
    const originalSrcsShare = new Map<HTMLImageElement, string>();
    
    try {
      if (!isRetry || !shouldShare) {
        // First attempt or not sharing - just show "Preparing"
        setImageLoadingProgress('Preparing...');
      }

      if (shouldShare) {
        setImageLoadingProgress(`Waiting for images to load (0/${allImagesShare.length})...`);
      }
      await waitForImagesToLoad(allImagesShare);
      await waitForPaint();
      await new Promise(resolve => setTimeout(resolve, isRetry ? 1000 : 500)); // Longer wait on retry

      if (shouldShare) {
        setImageLoadingProgress('Converting images...');
      }
      const conversionPromisesShare: Promise<void>[] = [];
      
      let convertedCountShare = 0;
      for (const img of Array.from(allImagesShare)) {
        if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {

          originalSrcsShare.set(img, img.src);

          conversionPromisesShare.push(
            imageToDataUrl(img)
              .then((dataUrl) => {
                img.src = dataUrl;
                if (shouldShare) {
                  convertedCountShare++;
                  setImageLoadingProgress(`Converting images (${convertedCountShare}/${allImagesShare.length})...`);
                }
              })
              .catch((err) => {
                console.error('Failed to convert image to data URL:', err);
                if (shouldShare) {
                  convertedCountShare++;
                  setImageLoadingProgress(`Converting images (${convertedCountShare}/${allImagesShare.length})...`);
                }
              })
          );
        }
      }
      
      await Promise.all(conversionPromisesShare);
      await waitForPaint();
      await new Promise(resolve => setTimeout(resolve, isRetry ? 500 : 200)); // Longer wait on retry

      if (shouldShare) {
        setImageLoadingProgress('Finalizing image...');
      }
      const dataUrl = await toPng(receiptRef.current, {
        backgroundColor: '#FAF9F6',
        pixelRatio: 2,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      
      if (!dataUrl) {
        throw new Error('Failed to generate image');
      }

      for (const [img, originalSrc] of originalSrcsShare.entries()) {
        img.src = originalSrc;
      }

      if (shouldShare) {

        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], `strava-receipt.png`, { type: 'image/png' });
        
        if (navigator.share) {

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Strava Receipt',
              text: `${selectedActivity.name} - ${formatDistance(selectedActivity.distance, units).toFixed(2)} ${units === 'miles' ? 'mi' : 'km'}\n\nreceipts.repete.art`
            });
          } else {
            // Fallback: share without file (text only)
            await navigator.share({
              title: 'Strava Receipt',
              text: `${selectedActivity.name} - ${formatDistance(selectedActivity.distance, units).toFixed(2)} ${units === 'miles' ? 'mi' : 'km'}\n\nreceipts.repete.art`
            });
          }
        } else {
          return { success: false, dataUrl }; // Share not available, but return dataUrl
        }
      }
      
      return { success: true, dataUrl }; // Success
    } catch (err: any) {
      console.error('Failed to share:', err);

      for (const [img, originalSrc] of originalSrcsShare.entries()) {
        img.src = originalSrc;
      }
      
      // If user cancelled, don't retry
      if (err.name === 'AbortError') {
        return { success: true, dataUrl: null }; // Treat cancellation as success (user intended)
      }
      
      return { success: false, dataUrl: null }; // Failed
    }
  };

  const handlePrint = async () => {
    if (!selectedActivity) return;
    
    setIsPrinting(true);
    setError(null);
    
    try {

      const statusResponse = await fetch('http://localhost:3001/status');
      if (!statusResponse.ok) {
        throw new Error('Print server is not available. Make sure it\'s running on port 3001.');
      }
      
      const printData = {
        activity: selectedActivity,
        route: selectedRoute || null,
        photos: selectedPhotos || null
      };
      
      const response = await fetch('http://localhost:3001/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(printData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Print failed' }));
        throw new Error(errorData.error || `Print server error: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ Print job sent:', result);
    } catch (err: any) {
      console.error('Failed to print:', err);
      setError(err.message || 'Failed to send print job. Make sure the print server is running.');
    } finally {
      setIsPrinting(false);
    }
  };

  // Share / save to phone - always run twice (second attempt always works for some reason lol)
  const handleShare = async () => {
    if (!receiptRef.current || !selectedActivity) return;
    
    setIsDownloading(true);
    
    try {
      
      let result = await performShare(false, false);
      setImageLoadingProgress('Finalizing...');
      await new Promise(resolve => setTimeout(resolve, 300));
      result = await performShare(true, true);
      
      if (!result.success) {
        if (!navigator.share) {
          handleDownload();
          return;
        }
        handleDownload();
        return;
      }
      
      // Share succeeded - check if we should show modal based on file size
      const hasImages = shouldHaveImages();
      let shouldShowModal = true;
      
      if (result.dataUrl && hasImages) {
        const fileSizeBytes = getDataUrlSize(result.dataUrl);
        const fileSizeKB = fileSizeBytes / 1024;
        
        if (fileSizeKB < 200) {
          // File is too small, images likely didn't load - don't show modal
          console.log(`File size too small (${fileSizeKB.toFixed(2)}KB), not showing modal`);
          shouldShowModal = false;
        }
      }

      if (shouldShowModal && !hasShownSupportModal) {
        setHasShownSupportModal(true);
        setShowSupportModal(true);
      }
    } catch (shareErr: any) {
      
      if (shareErr.name === 'AbortError') {
        return;
      }
      
      if (!hasShownSupportModal) {

        handleDownload();
        return;
      }
      
      console.error('Share attempt failed:', shareErr);
    } finally {
      setIsDownloading(false);
      setImageLoadingProgress('');
    }
  };

  let filteredActivities = filterType === 'All' 
    ? allActivities 
    : allActivities.filter(a => a.type === filterType);

  const sortedActivities = [...filteredActivities].sort((a, b) => {
    if (sortOrder === 'date-desc') {
      return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
    } else if (sortOrder === 'date-asc') {
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
    } else if (sortOrder === 'distance-desc') {
      return b.distance - a.distance;
    } else if (sortOrder === 'distance-asc') {
      return a.distance - b.distance;
    } else if (sortOrder === 'type-asc') {
      const typeCompare = a.type.localeCompare(b.type);
      if (typeCompare !== 0) return typeCompare;
      return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
    } else if (sortOrder === 'type-desc') {
      const typeCompare = b.type.localeCompare(a.type);
      if (typeCompare !== 0) return typeCompare;
      return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
    }
    return 0;
  });

  // Paginate - responsive per page count
  const [activitiesPerPage, setActivitiesPerPage] = useState(20);
  
  useEffect(() => {
    const updatePerPage = () => {
      setActivitiesPerPage(window.innerWidth < 1024 ? 3 : 20);
    };
    updatePerPage();
    window.addEventListener('resize', updatePerPage);
    return () => window.removeEventListener('resize', updatePerPage);
  }, []);
  
  const totalPages = Math.ceil(sortedActivities.length / activitiesPerPage);
  const paginatedActivities = sortedActivities.slice(
    (currentPage - 1) * activitiesPerPage,
    currentPage * activitiesPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, sortOrder]);

  // Render route SVG (grayscale)
  const renderRoute = useCallback(() => {
    if (!selectedRoute || selectedRoute.length < 2) return null;
    
    let minLat = selectedRoute[0].lat, maxLat = selectedRoute[0].lat;
    let minLng = selectedRoute[0].lng, maxLng = selectedRoute[0].lng;
    
    selectedRoute.forEach(p => {
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLng = Math.min(minLng, p.lng);
      maxLng = Math.max(maxLng, p.lng);
    });
    
    const padding = Math.max(maxLat - minLat, maxLng - minLng) * 0.1;
    minLat -= padding; maxLat += padding;
    minLng -= padding; maxLng += padding;
    
    const width = 280, height = 180;
    const pathData = selectedRoute.map((p, i) => {
      const x = ((p.lng - minLng) / (maxLng - minLng)) * width;
      const y = height - ((p.lat - minLat) / (maxLat - minLat)) * height;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
    
  return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: '180px' }}>
        <path d={pathData} stroke="#1A1A1A" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }, [selectedRoute]);

  // Remove emojis from text (for receipt-style display)
  const removeEmojis = (text: string): string => {
    if (!text) return text;
    // Remove emojis using regex pattern that matches most emoji ranges
    return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{200D}]|[\u{FE00}-\u{FE0F}]/gu, '').trim();
  };

  // Format location
  const formatLocation = (activity: StravaActivity) => {
    const parts = [];
    if (activity.location_city && activity.location_city.trim()) {
      parts.push(activity.location_city.toUpperCase().trim());
    }
    if (activity.location_state && activity.location_state.trim()) {
      parts.push(activity.location_state.toUpperCase().trim());
    }
    if (activity.location_country && activity.location_country.trim() && !activity.location_state) {
      parts.push(activity.location_country.toUpperCase().trim());
    }
    return parts.length > 0 ? parts.join(', ') : 'ACTIVITY';
  };

  // Format PR count (receipt-style, no emojis)
  const formatPRCount = (activity: StravaActivity): string | null => {
    if (!activity.achievements || activity.achievements.length === 0) {
      // Fallback to pr_count if achievements array is not available
      if (activity.pr_count && activity.pr_count > 0) {
        return `PROMOS (PRS): ${activity.pr_count}`;
      }
      return null;
    }

    const prs = activity.achievements.filter(a => a.type_id === 2 || a.type === 'pr' || a.type?.toLowerCase().includes('pr'));
    if (prs.length > 0) {
      return `PROMOS (PRS): ${prs.length}`;
    }
    
    // Fallback to pr_count
    if (activity.pr_count && activity.pr_count > 0) {
      return `PROMOS (PRS): ${activity.pr_count}`;
    }
    
    return null;
  };

  // Format achievement count (receipt-style, no emojis)
  const formatAchievementCount = (activity: StravaActivity): string | null => {
    if (activity.achievement_count && activity.achievement_count > 0) {
      return `ACHIEVEMENTS: ${activity.achievement_count}`;
    }
    return null;
  };

  const getStravaUrl = (activityId: number) => `https://www.strava.com/activities/${activityId}`;

  // Auth screen
  if (!accessToken) {
  return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: '#FAF9F6' }}>
        <div className="w-full max-w-[320px] text-center">
          {/* Header with About link */}
          <div className="flex justify-end mb-4">
            <Link 
              href="/about"
              className="text-[10px] text-[#666] hover:text-[#FC4C02] uppercase tracking-wider"
            >
              [ABOUT]
            </Link>
          </div>
          
        <Image
            src="/Strava_Logo.svg.png" 
            alt="STRAVA" 
            width={160} 
            height={40} 
            className="mx-auto mb-6"
            style={{ filter: 'grayscale(100%)' }}
          />
          <hr className="receipt-divider" />
          <h1 className="text-xl font-bold mb-2 uppercase tracking-widest">RECEIPT GENERATOR</h1>
          <p className="text-[#666] text-xs uppercase tracking-wider mb-6">
            TURN YOUR WORKOUTS INTO<br/>BEAUTIFUL RECEIPTS
          </p>
          <hr className="receipt-divider" />
          
          {error && <p className="text-red-500 mb-4 text-xs uppercase">{error}</p>}
          <button
            onClick={handleLogin}
            className="bg-[#FC4C02] hover:bg-[#E34402] text-white font-bold py-3 px-6 text-xs uppercase tracking-widest transition w-full mb-6"
          >
            CONNECT WITH STRAVA
          </button>
          
          {/* Receipt Preview Image */}
          <div className="mb-6 flex justify-center receipt-preview-container">
            <Image
              src="/receipt-preview.png"
              alt="Receipt Preview"
              width={320}
              height={400}
              className="receipt-shadow"
              style={{ 
                background: '#FAF9F6',
                fontFamily: "'Monaco', 'Menlo', 'Consolas', monospace"
              }}
            />
          </div>
          
          {/* About Link */}
          <div className="mb-6 text-center">
            <Link
              href="/about"
              className="text-[#FC4C02] hover:opacity-80 uppercase tracking-wider text-sm"
            >
              READ MORE ABOUT THIS PROJECT
            </Link>
          </div>
          
          {/* Social Links */}
          <div className="flex items-center justify-center gap-4 mb-6">
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
          
          <hr className="receipt-divider" />
          <p className="text-[#999] text-[10px] mt-6 uppercase tracking-wider">
            * * * THANK YOU * * *
          </p>
        </div>
      </div>
    );
  }

  // Main app - Mobile first layout
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#E8E5E0' }}>
      {/* Header */}
      <header className="border-b border-[#DDD] px-4 py-3 flex items-center justify-between" style={{ background: '#FAF9F6' }}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden text-[10px] text-[#666] hover:text-[#FC4C02] uppercase tracking-wider mr-2"
          >
            {sidebarOpen ? '[−]' : '[+]'}
          </button>
          <Image src="/Strava_Logo.svg.png" alt="STRAVA" width={70} height={18} style={{ filter: 'grayscale(100%)' }} />
          <span className="text-[10px] text-[#666] uppercase tracking-wider">/ RECEIPT</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:inline text-[10px] text-[#666] hover:text-[#FC4C02] uppercase tracking-wider"
          >
            {sidebarOpen ? '[−]' : '[+]'}
          </button>
          <Link 
            href="/about"
            className="text-[10px] text-[#666] hover:text-[#FC4C02] uppercase tracking-wider"
          >
            [ABOUT]
          </Link>
          <button onClick={handleLogout} className="text-[10px] text-[#666] hover:text-[#FC4C02] uppercase tracking-wider">
            [LOGOUT]
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Sidebar - Activity List */}
        <aside className={`${sidebarOpen ? 'flex' : 'hidden'} lg:flex lg:w-[320px] border-b lg:border-b-0 lg:border-r border-[#DDD] flex-col`} style={{ background: '#FAF9F6' }}>
          {/* Filter & Stats */}
          <div className="p-3 border-b border-[#DDD]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-[#666]">
                ACTIVITIES ({sortedActivities.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden text-[10px] uppercase tracking-wider text-[#666] hover:text-[#FC4C02]"
                >
                  [×]
                </button>
                <span className="text-[10px] uppercase tracking-wider text-[#999]">
                  {totalActivitiesLoaded} LOADED
                </span>
              </div>
            </div>
            {hasMoreActivities && (
              <div className="flex gap-2 mb-2">
                <button
                  onClick={loadMoreActivities}
                  disabled={isLoadingMore}
                  className="flex-1 text-[10px] uppercase tracking-wider py-2 border border-[#DDD] hover:border-[#FC4C02] hover:text-[#FC4C02] disabled:opacity-50"
                >
                  {isLoadingMore ? 'LOADING...' : 'LOAD MORE'}
                </button>
                <button
                  onClick={loadAllActivities}
                  disabled={isLoadingMore}
                  className="flex-1 text-[10px] uppercase tracking-wider py-2 border border-[#DDD] hover:border-[#FC4C02] hover:text-[#FC4C02] disabled:opacity-50"
                >
                  LOAD ALL
                </button>
              </div>
            )}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full text-xs p-2 border border-[#DDD] bg-white uppercase tracking-wider mb-2"
            >
              {ACTIVITY_TYPES.map(type => (
                <option key={type} value={type}>{type.toUpperCase()}</option>
              ))}
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full text-xs p-2 border border-[#DDD] bg-white uppercase tracking-wider"
            >
              <option value="date-desc">DATE (NEWEST)</option>
              <option value="date-asc">DATE (OLDEST)</option>
              <option value="distance-desc">DISTANCE (HIGHEST)</option>
              <option value="distance-asc">DISTANCE (LOWEST)</option>
              <option value="type-asc">TYPE (A-Z)</option>
              <option value="type-desc">TYPE (Z-A)</option>
            </select>
          </div>
          
          {/* Activity List - no scrolling on mobile, pagination only */}
          <div className="flex-1 lg:overflow-y-auto lg:max-h-none">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <span className="text-[10px] text-[#666] uppercase tracking-wider">LOADING...</span>
              </div>
            ) : (
              <>
                {paginatedActivities.map((activity) => (
                  <div
                    key={activity.id}
                    onClick={() => selectActivity(activity)}
                    className={`p-3 border-b border-[#DDD] cursor-pointer transition ${
                      selectedActivity?.id === activity.id 
                        ? 'bg-[#FC4C02] text-white' 
                        : 'hover:bg-[#F0EDE8]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase tracking-wider opacity-70">
                        {activity.type.toUpperCase()}
                      </span>
                      <span className="text-[10px] opacity-70 uppercase">
                        {new Date(activity.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs font-bold truncate uppercase">{activity.name.toUpperCase()}</div>
                    <div className="text-[10px] mt-1 opacity-80 uppercase">
                      {formatDistance(activity.distance, units).toFixed(2)} {units === 'miles' ? 'MI' : 'KM'} · {formatDuration(activity.elapsed_time).toUpperCase()}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Pagination */}
          <div className="p-3 border-t border-[#DDD]">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="text-[10px] uppercase tracking-wider disabled:opacity-30 hover:text-[#FC4C02]"
              >
                [PREV]
              </button>
              <span className="text-[10px] uppercase tracking-wider text-[#666]">
                {currentPage} / {totalPages || 1}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="text-[10px] uppercase tracking-wider disabled:opacity-30 hover:text-[#FC4C02]"
              >
                [NEXT]
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content - Receipt Preview */}
        <main className="flex-1 p-4 lg:p-8 flex flex-col items-center lg:overflow-hidden">
          {error && (
            <div className="w-[320px] mb-4 p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-red-600 text-xs uppercase tracking-wider text-center">{error}</p>
            </div>
          )}
          {selectedActivity ? (
            <>
              {/* Receipt format: Receipt-style layout with activity details, stats, route, and photos */}
              <div 
                ref={receiptRef}
                className="w-[320px] receipt-shadow"
                style={{ 
                  background: '#FAF9F6',
                  fontFamily: "'Monaco', 'Menlo', 'Consolas', monospace"
                }}
              >
                <div className="p-6">
                  <div className="text-center mb-4">
                    <img
                      src="/Strava_Logo.svg.png" 
                      alt="STRAVA" 
                      width={120} 
                      height={30} 
                      className="mx-auto mb-3"
                      style={{ filter: 'grayscale(100%)' }}
                    />
                    <div className="text-sm font-bold uppercase tracking-wider">
                      {removeEmojis(selectedActivity.name).toUpperCase()}
                    </div>
                    {showDescription && selectedActivity.description && (
                      <div className="text-[10px] text-[#666] mt-2 italic" style={{ fontStyle: 'italic', maxWidth: '280px', margin: '8px auto 0' }}>
                        {removeEmojis(selectedActivity.description)}
                      </div>
                    )}
                    {showLocation && (
                      <div className="text-[10px] text-[#666] mt-1 uppercase tracking-wider">
                        {formatLocation(selectedActivity)}
                      </div>
                    )}
                    <div className="text-[10px] text-[#666] mt-1 uppercase tracking-wider">
                      {formatDateLong(selectedActivity.start_date).toUpperCase()}
                    </div>
                  </div>

                  <hr className="receipt-divider" />

                  {/* Stats Header */}
                  <div className="flex justify-between text-[10px] uppercase tracking-wider text-[#666] mb-2">
                    <span>COUNT TYPE</span>
                    <span>NO. {units === 'miles' ? 'MILES' : 'KM'}</span>
                  </div>

                  {/* Activity Line */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs uppercase tracking-wider">
                      <span>1 {selectedActivity.type.toUpperCase()}</span>
                      <span>{formatDistance(selectedActivity.distance, units).toFixed(2)}</span>
                    </div>
                    {/* Indented stats like physical receipt */}
                    <div className="pl-3 mt-1 space-y-0.5 text-[10px] uppercase tracking-wider text-[#666]">
                      {showPace && (
                        <div>PACE: {calculatePace(selectedActivity.distance, selectedActivity.moving_time || selectedActivity.elapsed_time, units).toUpperCase()} /{units === 'miles' ? 'MI' : 'KM'}</div>
                      )}
                      {showHeartRate && selectedActivity.average_heartrate && (
                        <div>AVG HEART RATE: {Math.round(selectedActivity.average_heartrate)} BPM</div>
                      )}
                      {showElevation && (
                        <div>ELEVATION GAIN: {units === 'miles' ? `${Math.round(selectedActivity.total_elevation_gain * 3.28084)} FT` : `${Math.round(selectedActivity.total_elevation_gain)} M`}</div>
                      )}
                      {showGear && (selectedActivity.gear?.nickname || selectedActivity.gear?.name) && (
                        <div>GEAR: {(selectedActivity.gear.nickname || selectedActivity.gear.name).toUpperCase()}</div>
                      )}
                      {showAchievements && formatPRCount(selectedActivity) && (
                        <div>{formatPRCount(selectedActivity)}</div>
                      )}
                      {showAchievements && formatAchievementCount(selectedActivity) && (
                        <div>{formatAchievementCount(selectedActivity)}</div>
                      )}
                      {selectedActivity.calories && (
                        <div>CALORIES: {selectedActivity.calories}</div>
                      )}
                      {selectedActivity.device_name && (
                        <div>DEVICE: {selectedActivity.device_name.toUpperCase()}</div>
                      )}
                    </div>
                  </div>

                  <hr className="receipt-divider" />

                  {/* Total */}
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-1">
                    <span>TOTAL {units === 'miles' ? 'MILES' : 'KM'}</span>
                    <span>{formatDistance(selectedActivity.distance, units).toFixed(2)}</span>
                  </div>
                  <div className="text-[10px] text-[#999] text-right uppercase tracking-wider mb-3">
                    (STRAVA TAX INCL.)
                  </div>

                  {/* Route */}
                  {showRoute && selectedRoute && selectedRoute.length > 0 && (
                    <>
                      <hr className="receipt-divider" />
                      <div className="text-center text-[10px] uppercase tracking-wider mb-2 text-[#666]">
                        ROUTE SIGNATURE
                      </div>
                      <div className="mb-3 flex justify-center">
                        {renderRoute()}
                      </div>
                    </>
                  )}

                  {/* Photos */}
                  {showPhotos && selectedPhotos && selectedPhotos.length > 0 && (
                    <>
                      <hr className="receipt-divider" />
                      <div className="text-center text-[10px] uppercase tracking-wider mb-2 text-[#666]">
                        PHOTOS
                      </div>
                      <div className={`grid ${photoLayout === '1col' ? 'grid-cols-1' : 'grid-cols-2'} gap-1 mb-3`}>
                        {selectedPhotos
                          .map((photo, idx) => ({ photo, idx }))
                          .filter(({ idx }) => selectedPhotoIndices.has(idx))
                          .slice(0, photoLayout === '1col' ? 4 : 4)
                          .map(({ photo, idx: originalIndex }) => {
                          if (!photo.unique_id) return null;
                          
                          const index = originalIndex;

                          // Must match the format used in useMemo
                          const activityId = selectedActivity?.id || 'activity';
                          const uniqueId = `${activityId}-${photo.unique_id}-${index}`;
                          
                          // Use memoized URL instead of generating new one each render
                          const proxiedUrl = photoUrls.get(uniqueId);
                          if (!proxiedUrl) {
                            // Debug: log what we're looking for vs what we have
                            if (process.env.NODE_ENV === 'development') {
                              console.warn(`No URL found for uniqueId: ${uniqueId}. Available keys:`, Array.from(photoUrls.keys()));
                            }
                            return null;
                          }
                          
                          const loadState = photoLoadStates.get(uniqueId) || 'loading';
                          
                          return (
                            <div key={`photo-container-${uniqueId}`} className={`${photoLayout === '1col' ? 'aspect-[4/3]' : 'aspect-square'} overflow-hidden relative bg-[#FAF9F6]`}>
                              <img 
                                src={proxiedUrl}
                                alt={`ACTIVITY PHOTO ${index + 1}`}
                                className="w-full h-full object-cover activity-photo"
                                key={`photo-img-${uniqueId}`}
                                loading="eager"
                                crossOrigin="anonymous"
                                data-photo-id={photo.unique_id}
                                data-photo-index={index}
                                data-activity-id={selectedActivity?.id}
                                data-unique-id={uniqueId}
                                onLoad={(e) => {
                                  const img = e.currentTarget;
                                  setPhotoLoadStates(prev => {
                                    const next = new Map(prev);
                                    next.set(uniqueId, 'loaded');
                                    return next;
                                  });
                                }}
                                onError={(e) => {
                                  const img = e.currentTarget;
                                  setPhotoLoadStates(prev => {
                                    const next = new Map(prev);
                                    next.set(uniqueId, 'error');
                                    return next;
                                  });
                                  // Retry loading with the same URL (it's already unique)
                                  setTimeout(() => {
                                    const retryUrl = photoUrls.get(uniqueId);
                                    if (retryUrl && img.src !== retryUrl) {
                                      img.src = retryUrl;
                                    }
                                  }, 1000);
                                }}
                                style={enableDithering 
                                  ? { 
                                      filter: 'grayscale(100%) contrast(1.4) brightness(0.9)',
                                      imageRendering: 'pixelated'
                                    }
                                  : { filter: 'grayscale(100%)' }
                                }
                              />
                                {loadState === 'loading' && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-[#FAF9F6] text-[#999] text-[8px] uppercase">
                                    LOADING...
                                  </div>
                                )}
                                {loadState === 'error' && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-[#FAF9F6] text-[#666] text-[8px] uppercase">
                                    RETRYING...
                                  </div>
                                )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  <hr className="receipt-divider" />

                  {/* Suggested Gratuity - Title centered, items indented */}
                  <div className="mb-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-2 text-center">SUGGESTED GRATUITY</div>
                    <div className="text-[10px] text-[#666] uppercase tracking-wider space-y-0.5" style={{ paddingLeft: '15%' }}>
                      <div>[ ] GIVE SOME KUDOS</div>
                      <div>[ ] SHARE WITH A FRIEND</div>
                      <div>[ ] FOLLOW & TAG @_RE_PETE</div>
                    </div>
                  </div>

                  <hr className="receipt-divider" />

                  {/* QR Code */}
                  {showQRCode && (
                    <>
                      <hr className="receipt-divider" />
                      <div className="text-center mb-3">
                        <div className="text-[10px] uppercase tracking-wider mb-2 text-[#666]">VIEW ON STRAVA</div>
                        <div className="flex justify-center">
                          <QRCodeSVG 
                            value={getStravaUrl(selectedActivity.id)} 
                            size={80}
                            level="L"
                            bgColor="#FAF9F6"
                            fgColor="#1A1A1A"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <hr className="receipt-divider" />

                  {/* Footer */}
                  <div className="text-center text-[10px] text-[#666] uppercase tracking-wider space-y-1">
                    <div>&lt;&lt; {athleteCopyText.toUpperCase()} &gt;&gt;</div>
                    <div className="text-[#999] mt-2">CLAIM YOURS AT RECEIPTS.REPETE.ART</div>
                  </div>
                </div>
              </div>

              {/* Receipt Options - Below receipt */}
              <div className="mt-4 w-[320px]">
                {/* Always visible: Units (prominent) */}
                <div className="mb-3 p-3 border border-[#DDD] bg-white">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">UNITS</span>
                    <select
                      value={units}
                      onChange={(e) => setUnits(e.target.value as 'miles' | 'km')}
                      className="text-xs px-3 py-2 border-2 border-[#FC4C02] bg-white uppercase tracking-wider cursor-pointer font-bold text-[#FC4C02] hover:bg-[#FC4C02] hover:text-white transition"
                    >
                      <option value="miles">MILES</option>
                      <option value="km">KILOMETERS</option>
                    </select>
                  </div>
                </div>

                {/* Always visible: Quick toggles */}
                <div className="mb-3 space-y-1.5">
                  <label className="flex items-center justify-between cursor-pointer text-[10px] uppercase tracking-wider text-[#666] py-1">
                    <span>LOCATION</span>
                    <input
                      type="checkbox"
                      checked={showLocation}
                      onChange={(e) => setShowLocation(e.target.checked)}
                      className="w-3 h-3 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer text-[10px] uppercase tracking-wider text-[#666] py-1">
                    <span>DESCRIPTION</span>
                    <input
                      type="checkbox"
                      checked={showDescription}
                      onChange={(e) => setShowDescription(e.target.checked)}
                      className="w-3 h-3 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer text-[10px] uppercase tracking-wider text-[#666] py-1">
                    <span>PHOTOS</span>
                    <input
                      type="checkbox"
                      checked={showPhotos}
                      onChange={(e) => setShowPhotos(e.target.checked)}
                      className="w-3 h-3 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer text-[10px] uppercase tracking-wider text-[#666] py-1">
                    <span>QR CODE</span>
                    <input
                      type="checkbox"
                      checked={showQRCode}
                      onChange={(e) => setShowQRCode(e.target.checked)}
                      className="w-3 h-3 cursor-pointer"
                    />
                  </label>
                </div>

                {/* More Options - Collapsible */}
                <button
                  onClick={() => setShowMoreOptions(!showMoreOptions)}
                  className="w-full text-left text-[10px] uppercase tracking-wider text-[#666] py-2 border-t border-[#DDD] flex items-center justify-between hover:text-[#FC4C02] transition"
                >
                  <span>MORE OPTIONS</span>
                  <span className="text-[#999]">{showMoreOptions ? '−' : '+'}</span>
                </button>
                {showMoreOptions && (
                <div className="mt-2 space-y-2">
                  {/* Route Toggle */}
                  <label className="flex items-center justify-between cursor-pointer text-[10px] uppercase tracking-wider text-[#666]">
                    <span>ROUTE</span>
                    <input
                      type="checkbox"
                      checked={showRoute}
                      onChange={(e) => setShowRoute(e.target.checked)}
                      className="w-3 h-3 cursor-pointer"
                    />
                  </label>

                  {/* Stats Toggles */}
                  <div className="border-t border-[#DDD] pt-2 space-y-1.5">
                    <label className="flex items-center justify-between cursor-pointer text-[10px] uppercase tracking-wider text-[#666]">
                      <span>PACE</span>
                      <input
                        type="checkbox"
                        checked={showPace}
                        onChange={(e) => setShowPace(e.target.checked)}
                        className="w-3 h-3 cursor-pointer"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer text-[10px] uppercase tracking-wider text-[#666]">
                      <span>HEART RATE</span>
                      <input
                        type="checkbox"
                        checked={showHeartRate}
                        onChange={(e) => setShowHeartRate(e.target.checked)}
                        className="w-3 h-3 cursor-pointer"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer text-[10px] uppercase tracking-wider text-[#666]">
                      <span>ELEVATION</span>
                      <input
                        type="checkbox"
                        checked={showElevation}
                        onChange={(e) => setShowElevation(e.target.checked)}
                        className="w-3 h-3 cursor-pointer"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer text-[10px] uppercase tracking-wider text-[#666]">
                      <span>GEAR</span>
                      <input
                        type="checkbox"
                        checked={showGear}
                        onChange={(e) => setShowGear(e.target.checked)}
                        className="w-3 h-3 cursor-pointer"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer text-[10px] uppercase tracking-wider text-[#666]">
                      <span>PRS / KOMS</span>
                      <input
                        type="checkbox"
                        checked={showAchievements}
                        onChange={(e) => setShowAchievements(e.target.checked)}
                        className="w-3 h-3 cursor-pointer"
                      />
                    </label>
                  </div>

                  {/* Photo Options */}
                  <div className="border-t border-[#DDD] pt-2 space-y-1.5">
                    <label className="flex items-center justify-between cursor-pointer text-[10px] uppercase tracking-wider text-[#666]">
                      <span>DITHER</span>
                      <input
                        type="checkbox"
                        checked={enableDithering}
                        onChange={(e) => setEnableDithering(e.target.checked)}
                        className="w-3 h-3 cursor-pointer"
                      />
                    </label>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-[#666]">PHOTO LAYOUT</span>
                      <select
                        value={photoLayout}
                        onChange={(e) => setPhotoLayout(e.target.value as '1col' | '2x2')}
                        className="text-[10px] px-2 py-1 border border-[#DDD] bg-white uppercase tracking-wider cursor-pointer"
                      >
                        <option value="1col">1 COL</option>
                        <option value="2x2">2x2</option>
                      </select>
                    </div>
                    {selectedPhotos && selectedPhotos.length > 0 && (
                      <div className="border-t border-[#DDD] pt-2 mt-2">
                        <div className="text-[10px] uppercase tracking-wider text-[#666] mb-2">SELECT PHOTOS</div>
                        <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                          {selectedPhotos.map((photo, index) => (
                            <label key={index} className="flex items-center gap-1.5 cursor-pointer text-[9px] uppercase tracking-wider text-[#666]">
                              <input
                                type="checkbox"
                                checked={selectedPhotoIndices.has(index)}
                                onChange={(e) => {
                                  const newIndices = new Set(selectedPhotoIndices);
                                  if (e.target.checked) {
                                    newIndices.add(index);
                                  } else {
                                    newIndices.delete(index);
                                  }
                                  setSelectedPhotoIndices(newIndices);
                                }}
                                className="w-3 h-3 cursor-pointer"
                              />
                              <span className="truncate">PHOTO {index + 1}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer Text */}
                  <div className="border-t border-[#DDD] pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-[#666]">FOOTER</span>
                      <input
                        type="text"
                        value={athleteCopyText}
                        onChange={(e) => setAthleteCopyText(e.target.value)}
                        className="text-[10px] px-2 py-1 border border-[#DDD] bg-white uppercase tracking-wider w-[140px]"
                        placeholder="ATHLETE COPY"
                      />
                    </div>
                  </div>
                </div>
                )}
              </div>

              {/* Action Buttons - Below receipt */}
              <div className="flex flex-col gap-2 mt-4 w-[320px]">
                <div className="flex gap-2">
                  <button 
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="flex-1 bg-[#FC4C02] hover:bg-[#E34402] text-white text-[10px] font-bold py-3 uppercase tracking-widest transition disabled:opacity-50"
                  >
                    {isDownloading ? (imageLoadingProgress || 'PROCESSING...') : 'DOWNLOAD'}
                  </button>
                  <button 
                    onClick={handleShare}
                    disabled={isDownloading}
                    className="flex-1 bg-[#1A1A1A] hover:bg-[#333] text-white text-[10px] font-bold py-3 uppercase tracking-widest transition disabled:opacity-50"
                  >
                    {isDownloading ? (imageLoadingProgress || 'PROCESSING...') : 'SHARE / SAVE'}
                  </button>
                </div>

                {isLocalhost && (
                  <button 
                    onClick={handlePrint}
                    disabled={isPrinting || !selectedActivity}
                    className="w-full bg-[#666] hover:bg-[#777] text-white text-[10px] font-bold py-3 uppercase tracking-widest transition disabled:opacity-50"
                  >
                    {isPrinting ? 'PRINTING...' : 'PRINT RECEIPT'}
                  </button>
                )}
              </div>

              {/* Social Links - Below receipt */}
              <div className="flex items-center justify-center gap-4 mt-4">
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

              {/* Buy Me a Coffee Button - Below receipt */}
              <div className="flex justify-center mt-4">
                <a
                  href="https://www.buymeacoffee.com/repete"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] uppercase tracking-wider py-2 px-4 border border-[#DDD] hover:border-[#FC4C02] hover:text-[#FC4C02] transition"
                >
                  ☕ BUY ME A COFFEE
                </a>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[#666]">
              <span className="text-3xl mb-3">🏃</span>
              <p className="text-[10px] uppercase tracking-widest">SELECT AN ACTIVITY</p>
        </div>
          )}
      </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#DDD] px-4 py-3 text-center" style={{ background: '#FAF9F6' }}>
        <p className="text-[10px] text-[#666] uppercase tracking-wider">
          BUILT WITH LOVE BY{' '}
          <a 
            href="https://repete.art" 
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FC4C02] hover:underline"
          >
            PETE
          </a>
          {' :D'}
        </p>
      </footer>

      {/* Support Modal */}
      {/* Loading Overlay */}
      {isDownloading && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(2px)' }}
        >
          <div 
            className="bg-[#FAF9F6] rounded-lg p-10 max-w-[360px] w-full receipt-shadow text-center relative overflow-hidden"
            style={{ fontFamily: "'Monaco', 'Menlo', 'Consolas', monospace" }}
          >
            {/* Subtle background animation */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#FC4C02] to-transparent animate-pulse"></div>
            </div>
            
            <div className="relative z-10">
              {/* Minimal spinner */}
              <div className="mb-6 flex justify-center">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 border-2 border-[#FC4C02]/20 rounded-full"></div>
                  <div className="absolute inset-0 border-2 border-transparent border-t-[#FC4C02] rounded-full animate-spin" style={{ animationDuration: '1s' }}></div>
                  <div className="absolute inset-2 border-2 border-transparent border-r-[#FC4C02] rounded-full animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
                </div>
              </div>
              
              <h2 className="text-sm font-medium tracking-wide mb-3 text-[#1A1A1A]">
                Processing your receipt
                <span className="inline-block ml-1">
                  <span className="animate-pulse" style={{ animationDelay: '0s' }}>.</span>
                  <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>.</span>
                  <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>.</span>
                </span>
              </h2>
              
              {imageLoadingProgress && (
                <p className="text-[10px] text-[#999] tracking-wide mt-2">
                  {imageLoadingProgress}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Support Modal */}
      {showSupportModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
          onClick={() => setShowSupportModal(false)}
        >
          <div 
            className="bg-[#FAF9F6] rounded-lg p-6 max-w-[400px] w-full receipt-shadow"
            style={{ fontFamily: "'Monaco', 'Menlo', 'Consolas', monospace" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold uppercase tracking-wider mb-2">
                THANK YOU!
              </h2>
              <p className="text-xs text-[#666] uppercase tracking-wider mb-1">
                THANKS FOR MAKING YOUR RECEIPT!
              </p>
              <p className="text-xs text-[#666] uppercase tracking-wider">
                IT'D MEAN THE WORLD IF YOU COULD
              </p>
              <p className="text-xs text-[#666] uppercase tracking-wider mb-4">
                SUPPORT WITH A FOLLOW OR A COFFEE :D
              </p>
            </div>

            <hr className="receipt-divider mb-4" />

            {/* Social Links */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <a
                href="https://www.instagram.com/_re_pete"
                target="_blank"
                rel="noopener noreferrer"
                className="social-link"
                title="Instagram"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.599h4.172L10.463 0l-7.007 13.828h4.169"/>
                </svg>
              </a>
            </div>

            {/* Buy Me a Coffee Button */}
            <div className="flex justify-center mb-4">
              <a
                href="https://www.buymeacoffee.com/repete"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs uppercase tracking-wider py-3 px-6 border-2 border-[#FC4C02] text-[#FC4C02] hover:bg-[#FC4C02] hover:text-white transition"
              >
                ☕ BUY ME A COFFEE
              </a>
            </div>

            <button
              onClick={() => setShowSupportModal(false)}
              className="w-full text-[10px] uppercase tracking-wider text-[#666] hover:text-[#FC4C02] py-2"
            >
              [CLOSE]
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
