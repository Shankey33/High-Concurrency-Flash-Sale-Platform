package com.pm.loadtest.service;

import org.springframework.stereotype.Service;
import com.pm.common.dto.TestEventDTO;

import java.util.UUID;

@Service
public class LoadTestService {

    public TestEventDTO startTest(TestEventDTO testEventDTO){
        String testId = UUID.randomUUID().toString();
        int user = testEventDTO.getUsers();
        Double spawnRate = testEventDTO.getSpawnRate();
        int durationMs = testEventDTO.getDurationMs();
        int quantity = testEventDTO.getQuantity();

        //Will run test here

        //Set results from the test to event dto and return it

        testEventDTO.setTestId(testId);
        testEventDTO.setTotalRequests(1000);
        testEventDTO.setSuccessCount(1000);
        testEventDTO.setFailureCount(0);
        testEventDTO.setAvgLatencyMs(1);
        testEventDTO.setP95LatencyMs(1);
        testEventDTO.setRemainingStock(0);
        testEventDTO.setOversellDetected(false);
        testEventDTO.setStatus(TestEventDTO.TestStatus.PASSED);

        return testEventDTO;
    }
}
