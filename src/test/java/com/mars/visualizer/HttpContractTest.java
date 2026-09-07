package com.mars.visualizer;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.mars.visualizer.config.DataPathConfig;
import com.mars.visualizer.controller.SliceController;
import com.mars.visualizer.service.NetCDFReaderService;
import com.mars.visualizer.service.ValidationService;
import com.mars.visualizer.util.DatasetResolver;

/**
 * Contrat HTTP de l'API : le code de retour doit dire la vérité.
 *
 * <p>Le gestionnaire générique attrapait {@code HttpRequestMethodNotSupportedException}
 * et répondait 500 en journalisant une trace complète au niveau ERROR. Un robot
 * qui balaie un site public envoie exactement ce genre de requête : l'API se
 * déclarait en panne, et le journal se remplissait de traces pour rien.
 */
@WebMvcTest(SliceController.class)
class HttpContractTest {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private NetCDFReaderService netcdfService;

	@MockitoBean
	private ValidationService validationService;

	@MockitoBean
	private DataPathConfig dataPathConfig;

	@MockitoBean
	private DatasetResolver datasetResolver;

	@Test
	@DisplayName("POST sur un endpoint de lecture : 405, pas 500")
	void postRenvoie405() throws Exception {
		mockMvc.perform(post("/api/data/slice"))
				.andExpect(status().isMethodNotAllowed());
	}

	@Test
	@DisplayName("DELETE sur un endpoint de lecture : 405, pas 500")
	void deleteRenvoie405() throws Exception {
		mockMvc.perform(delete("/api/data/slice"))
				.andExpect(status().isMethodNotAllowed());
	}

	@Test
	@DisplayName("Un 405 annonce les méthodes autorisées (RFC 9110)")
	void le405PorteLenTeteAllow() throws Exception {
		mockMvc.perform(put("/api/data/slice"))
				.andExpect(status().isMethodNotAllowed())
				.andExpect(header().string("Allow", org.hamcrest.Matchers.containsString("GET")));
	}

	@Test
	@DisplayName("Le corps du 405 garde la forme d'erreur commune")
	void le405GardeLeCorpsJson() throws Exception {
		mockMvc.perform(post("/api/data/slice"))
				.andExpect(jsonPath("$.error").exists())
				.andExpect(jsonPath("$.message").exists())
				.andExpect(jsonPath("$.timestamp").exists());
	}
}
