package com.mars.visualizer.config;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

/**
 * Simple in-memory rate limiter per IP.
 * Limits API requests to a configurable number per minute.
 * Returns 429 Too Many Requests when exceeded.
 */
@Component
@Slf4j
public class RateLimitFilter implements Filter {

	@Value("${ratelimit.requests-per-minute:120}")
	private int maxRequestsPerMinute;

	@Value("${ratelimit.export-per-minute:20}")
	private int maxExportPerMinute;

	private final Map<String, WindowCounter> counters = new ConcurrentHashMap<>();
	private final Map<String, WindowCounter> exportCounters = new ConcurrentHashMap<>();

	@Override
	public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
			throws IOException, ServletException {

		HttpServletRequest httpReq = (HttpServletRequest) request;
		String path = httpReq.getRequestURI();

		// Only rate-limit API endpoints
		if (!path.startsWith("/api/")) {
			chain.doFilter(request, response);
			return;
		}

		String ip = getClientIp(httpReq);

		// Stricter limit for export endpoints (generate large files)
		if (path.startsWith("/api/export/")) {
			WindowCounter exportCounter = exportCounters.computeIfAbsent(ip, k -> new WindowCounter());
			if (!exportCounter.incrementAndCheck(maxExportPerMinute)) {
				HttpServletResponse httpResp = (HttpServletResponse) response;
				httpResp.setStatus(429);
				httpResp.setContentType("application/json");
				httpResp.getWriter().write("{\"error\":\"Too Many Requests\",\"message\":\"Export rate limit exceeded. Max " + maxExportPerMinute + " exports per minute.\"}");
				log.warn("Export rate limit exceeded for IP: {} on {}", sanitize(ip), sanitize(path));
				return;
			}
		}

		WindowCounter counter = counters.computeIfAbsent(ip, k -> new WindowCounter());

		if (counter.incrementAndCheck(maxRequestsPerMinute)) {
			chain.doFilter(request, response);
		} else {
			HttpServletResponse httpResp = (HttpServletResponse) response;
			httpResp.setStatus(429);
			httpResp.setContentType("application/json");
			httpResp.getWriter().write("{\"error\":\"Too Many Requests\",\"message\":\"Rate limit exceeded. Max " + maxRequestsPerMinute + " requests per minute.\"}");
			log.warn("Rate limit exceeded for IP: {} on {}", sanitize(ip), sanitize(path));
		}

		// Cleanup stale entries (> 65s old) when maps grow beyond 100 IPs
		if (counters.size() > 100) {
			long cutoff = System.currentTimeMillis();
			counters.entrySet().removeIf(e -> cutoff - e.getValue().windowStart > 65_000);
		}
		if (exportCounters.size() > 100) {
			long cutoff = System.currentTimeMillis();
			exportCounters.entrySet().removeIf(e -> cutoff - e.getValue().windowStart > 65_000);
		}
	}

	/**
	 * Extracts the client IP from the request.
	 * Only trusts X-Forwarded-For when server.forward-headers-strategy=framework
	 * is set (meaning a trusted reverse proxy is configured).
	 */
	private String getClientIp(HttpServletRequest request) {
		String xff = request.getHeader("X-Forwarded-For");
		if (xff != null && !xff.isEmpty()) {
			// Take only the first (client) IP; subsequent are proxy chain
			String clientIp = xff.split(",")[0].trim();
			// Basic validation: reject obviously forged values
			if (clientIp.length() <= 45 && clientIp.matches("[0-9a-fA-F.:]+")) {
				return clientIp;
			}
		}
		return request.getRemoteAddr();
	}

	/** Sanitize log input to prevent log injection (strip CR/LF). */
	private static String sanitize(String input) {
		return input == null ? "" : input.replaceAll("[\\r\\n]", " ");
	}

	/**
	 * Simple sliding window counter: resets every minute.
	 */
	private static class WindowCounter {
		volatile long windowStart = System.currentTimeMillis();
		final AtomicInteger count = new AtomicInteger(0);

		boolean incrementAndCheck(int max) {
			long now = System.currentTimeMillis();
			if (now - windowStart > 60_000) {
				// New window
				windowStart = now;
				count.set(1);
				return true;
			}
			return count.incrementAndGet() <= max;
		}
	}
}
