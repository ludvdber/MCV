package com.mars.visualizer;

import static org.assertj.core.api.Assertions.*;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import com.mars.visualizer.config.SecurityHeadersFilter;

class SecurityHeadersFilterTest {

    private final SecurityHeadersFilter filter = new SecurityHeadersFilter();

    @Test
    @DisplayName("X-Content-Type-Options est nosniff")
    void xContentTypeOptionsEstNosniff() throws Exception {
        MockHttpServletResponse response = doFilter();
        assertThat(response.getHeader("X-Content-Type-Options")).isEqualTo("nosniff");
    }

    @Test
    @DisplayName("X-Frame-Options est DENY")
    void xFrameOptionsEstDeny() throws Exception {
        MockHttpServletResponse response = doFilter();
        assertThat(response.getHeader("X-Frame-Options")).isEqualTo("DENY");
    }

    @Test
    @DisplayName("Referrer-Policy est no-referrer")
    void referrerPolicyEstNoReferrer() throws Exception {
        MockHttpServletResponse response = doFilter();
        assertThat(response.getHeader("Referrer-Policy")).isEqualTo("no-referrer");
    }

    @Test
    @DisplayName("X-XSS-Protection est 0")
    void xXssProtectionEstZero() throws Exception {
        MockHttpServletResponse response = doFilter();
        assertThat(response.getHeader("X-XSS-Protection")).isEqualTo("0");
    }

    @Test
    @DisplayName("CSP contient default-src 'self'")
    void cspContientDefaultSrcSelf() throws Exception {
        MockHttpServletResponse response = doFilter();
        String csp = response.getHeader("Content-Security-Policy");
        assertThat(csp).contains("default-src 'self'");
    }

    @Test
    @DisplayName("CSP contient object-src 'none'")
    void cspContientObjectSrcNone() throws Exception {
        MockHttpServletResponse response = doFilter();
        String csp = response.getHeader("Content-Security-Policy");
        assertThat(csp).contains("object-src 'none'");
    }

    @Test
    @DisplayName("CSP contient script-src 'self'")
    void cspContientScriptSrcSelf() throws Exception {
        MockHttpServletResponse response = doFilter();
        String csp = response.getHeader("Content-Security-Policy");
        assertThat(csp).contains("script-src 'self'");
    }

    @Test
    @DisplayName("HSTS header est présent")
    void hstsHeaderPresent() throws Exception {
        MockHttpServletResponse response = doFilter();
        assertThat(response.getHeader("Strict-Transport-Security"))
                .contains("max-age=31536000");
    }

    @Test
    @DisplayName("Permissions-Policy est présent")
    void permissionsPolicyPresent() throws Exception {
        MockHttpServletResponse response = doFilter();
        assertThat(response.getHeader("Permissions-Policy"))
                .contains("camera=()");
    }

    @Test
    @DisplayName("CSP contient img-src avec blob: et data:")
    void cspContientImgSrc() throws Exception {
        MockHttpServletResponse response = doFilter();
        String csp = response.getHeader("Content-Security-Policy");
        assertThat(csp).contains("img-src 'self' data: blob:");
    }

    @Test
    @DisplayName("Filter appelle chain.doFilter (requête transmise)")
    void filterAppelleChainDoFilter() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(chain.getRequest())
                .as("La requête doit être transmise au filtre suivant")
                .isNotNull();
    }

    private MockHttpServletResponse doFilter() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }
}
