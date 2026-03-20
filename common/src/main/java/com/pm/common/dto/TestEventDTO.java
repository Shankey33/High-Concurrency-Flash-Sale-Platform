package com.pm.common.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TestEventDTO {

    private String testId;

    @Min(1)
    private int users;

    @NotNull
    @DecimalMin("1.0")
    private Double spawnRate;

    @NotNull
    @Min(1)
    private int durationMs;

    @Min(0)
    private int quantity;

    private int totalRequests;

    private int successCount;

    private int failureCount;

    private int avgLatencyMs;

    private int p95LatencyMs;

    private int remainingStock;

    private boolean oversellDetected;

    private TestStatus status;

    public enum TestStatus {
        PASSED,
        FAILED
    }
}