package com.pm.loadtest.service;

import com.pm.common.dto.BuyRequestDTO;
import com.pm.loadtest.model.Test;
import com.pm.loadtest.repository.LoadTestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

@Service
@RequiredArgsConstructor
@Slf4j
public class RunTestAsync {

    private final LoadTestRepository loadTestRepository;
    private final RestTemplate restTemplate;

    @Value("${loadtest.buy-url}")
    private String baseUrl;

    @Value("${loadtest.productId}")
    private String productId;

    @Async("loadTestExecutor")
    public void runTest(String testId) {
        List<Long> latencies = Collections.synchronizedList(new ArrayList<>());
        Optional<Test> testModel = loadTestRepository.findById(testId);

        if (testModel.isEmpty()) {
            log.warn("Test not found when trying to fetch in RunTestAsync service!");
            return;
        }

        Test test = testModel.get();
        int users = test.getUsers();
        double spawnRate = test.getSpawnRate();
        long delayMs = spawnRate > 0 ? (long) (1000 / spawnRate) : 0;
        String url = baseUrl + productId;

        AtomicInteger success = new AtomicInteger(0);
        AtomicInteger failure = new AtomicInteger(0);
        AtomicLong totalLatency = new AtomicLong(0);

        log.info("Starting Load Test with Virtual Threads. Target URL: {}", url);

        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {

            for (int i = 0; i < users; i++) {
                executor.submit(() -> {
                    long endTime = System.currentTimeMillis() + test.getDurationMs();

                    while (System.currentTimeMillis() < endTime) {
                        long start = System.currentTimeMillis();
                        try {
                            BuyRequestDTO request = new BuyRequestDTO();

                            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);

                            if (response.getStatusCode().is2xxSuccessful()) {
                                success.incrementAndGet();
                                break;
                            } else {
                                failure.incrementAndGet();
                            }


                            Thread.sleep((long) (Math.random() * 10) + 1);

                        } catch (Exception e) {
                            log.error("Request failed: {}", e.getMessage());
                            failure.incrementAndGet();
                        } finally {
                            long latency = System.currentTimeMillis() - start;
                            latencies.add(latency);
                            totalLatency.addAndGet(latency);
                        }
                    }
                });

                try {
                    Thread.sleep(delayMs);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
        }

        int totalReq = success.get() + failure.get();
        long avgLatency = totalReq == 0 ? 0 : totalLatency.get() / totalReq;

        Collections.sort(latencies);
        long p95 = 0;
        if (!latencies.isEmpty()) {
            int index = (int) (0.95 * latencies.size());
            p95 = latencies.get(Math.min(index, latencies.size() - 1));
        }

        boolean overSell = success.get() > test.getQuantity();
        int remaining = Math.max(0, test.getQuantity() - success.get());

        test.setTotalRequests(totalReq);
        test.setSuccessCount(success.get());
        test.setFailureCount(failure.get());
        test.setAvgLatencyMs(avgLatency);
        test.setP95LatencyMs(p95);
        test.setRemainingStock(remaining);
        test.setOversellDetected(overSell);
        test.setStatus(overSell ? Test.FinalStatus.FAILED : Test.FinalStatus.PASSED);

        loadTestRepository.save(test);
        log.info("Test Finished!: Success={}, Failures={}, Oversell={}", success.get(), failure.get(), overSell);
    }
}