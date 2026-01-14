// Link Preview Component with caching
import { useState, useEffect } from "react";
import { getLinkPreview } from "link-preview-js";
import {
  Maximize2,
  Globe,
  ExternalLink,
  Play,
  ImageIcon,
  Link,
} from "lucide-react";

interface LinkPreviewProps {
  url: string;
}

const LinkPreview: React.FC<LinkPreviewProps> = ({ url }) => {
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchPreview = async () => {
      setLoading(true);
      setError(false);

      try {
        // Check cache first
        const cacheKey = `link-preview-${btoa(url)}`;
        const cached = localStorage.getItem(cacheKey);

        if (cached) {
          const cachedData = JSON.parse(cached);
          // Use cache if less than 1 hour old
          if (Date.now() - cachedData.timestamp < 3600000) {
            setPreview(cachedData.data);
            setLoading(false);
            return;
          }
        }

        // Fetch new preview
        const data = await getLinkPreview(url, {
          timeout: 5000,
          headers: {
            "user-agent":
              "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
            accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "accept-language": "en-US,en;q=0.9",
            "cache-control": "max-age=0",
          },
          followRedirects: "follow",
        });

        // Cache the result
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            data,
            timestamp: Date.now(),
          })
        );

        setPreview(data);
      } catch (err) {
        console.error("Failed to fetch link preview:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [url]);

  if (loading) {
    return (
      <div className="border rounded-lg p-3 bg-card/50 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-muted rounded"></div>
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-muted rounded w-3/4"></div>
            <div className="h-2 bg-muted rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="border rounded-lg p-3 bg-card/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link className="h-4 w-4 text-muted-foreground" />
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline truncate max-w-[200px]"
            >
              {new URL(url).hostname}
            </a>
          </div>
          <ExternalLink className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>
    );
  }

  const hostname = new URL(url).hostname;
  const isVideo =
    preview.mediaType?.includes("video") ||
    hostname.includes("youtube") ||
    hostname.includes("vimeo");
  const isImage = preview.mediaType?.includes("image");
  const isWSF = hostname.includes("worldsamma.org");

  return (
    <div
      className={`border rounded-lg overflow-hidden bg-card/50 hover:bg-card/70 transition-colors ${
        expanded ? "col-span-2" : ""
      }`}
    >
      <div className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {preview.favicons && preview.favicons[0] ? (
              <img
                src={preview.favicons[0]}
                alt=""
                className="h-4 w-4 rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <Globe className="h-4 w-4 text-muted-foreground" />
            )}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground truncate hover:text-foreground"
            >
              {hostname}
            </a>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 hover:bg-muted rounded"
              title={expanded ? "Collapse" : "Expand"}
            >
              <Maximize2 className="h-3 w-3" />
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:bg-muted rounded"
              title="Open in new tab"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block group"
        >
          {/* Thumbnail/Image */}
          {preview.images && preview.images[0] && !isVideo && (
            <div
              className={`mb-2 rounded overflow-hidden ${
                expanded ? "max-h-48" : "max-h-24"
              }`}
            >
              <img
                src={preview.images[0]}
                alt={preview.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}

          {/* Content */}
          <div>
            <h4 className="font-medium text-sm mb-1 line-clamp-2 group-hover:text-primary transition-colors">
              {preview.title || hostname}
            </h4>
            {preview.description && (
              <p
                className={`text-xs text-muted-foreground ${
                  expanded ? "line-clamp-4" : "line-clamp-2"
                }`}
              >
                {preview.description}
              </p>
            )}

            {/* Special badges */}
            <div className="flex items-center gap-2 mt-2">
              {isWSF && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary">
                  <Globe className="h-2.5 w-2.5" />
                  WSF Official
                </span>
              )}
              {isVideo && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  <Play className="h-2.5 w-2.5" />
                  Video
                </span>
              )}
              {isImage && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  <ImageIcon className="h-2.5 w-2.5" />
                  Image
                </span>
              )}
            </div>
          </div>
        </a>
      </div>
    </div>
  );
};

export default LinkPreview;
