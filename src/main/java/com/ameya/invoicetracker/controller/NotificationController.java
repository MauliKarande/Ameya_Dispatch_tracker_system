package com.ameya.invoicetracker.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    // Thread-safe list of active SSE emitters (one per connected browser tab)
    private static final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();
    private static final ObjectMapper mapper = createObjectMapper();

    private static ObjectMapper createObjectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        mapper.findAndRegisterModules();
        return mapper;
    }

    /**
     * Client subscribes to real-time notifications via Server-Sent Events.
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(()    -> emitters.remove(emitter));
        emitter.onError(e      -> emitters.remove(emitter));
        // Send a ping immediately so the connection is confirmed
        try {
            emitter.send(SseEmitter.event().name("ping").data("connected"));
        } catch (Exception e) {
            emitters.remove(emitter);
        }
        return emitter;
    }

    /**
     * Heartbeat every 5 seconds — prevents proxies/browsers from closing idle SSE connections.
     * This is why updates can take up to 10-30 seconds without it.
     */
    @Scheduled(fixedDelay = 5000)
    public void sendHeartbeat() {
        List<SseEmitter> dead = new CopyOnWriteArrayList<>();
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("heartbeat").data("ping"));
            } catch (Exception e) {
                dead.add(emitter);
            }
        }
        emitters.removeAll(dead);
    }

    /**
     * Called internally by service layer to push a text notification to all connected clients.
     */
    public static void broadcast(String eventType, String message) {
        List<SseEmitter> dead = new CopyOnWriteArrayList<>();
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event()
                    .name(eventType)
                    .data(message));
            } catch (Exception e) {
                dead.add(emitter);
            }
        }
        emitters.removeAll(dead);
    }

    /**
     * Broadcast text message + data object for real-time updates (e.g., updated work order)
     */
    public static void broadcastWithData(String eventType, String message, Object data) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("message", message);
        payload.put("data", data);

        String payloadJson;
        try {
            payloadJson = mapper.writeValueAsString(payload);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to serialize SSE notification payload", e);
        }

        List<SseEmitter> dead = new CopyOnWriteArrayList<>();
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event()
                    .name(eventType)
                    .data(payloadJson));
            } catch (Exception e) {
                dead.add(emitter);
            }
        }
        emitters.removeAll(dead);
    }
}
