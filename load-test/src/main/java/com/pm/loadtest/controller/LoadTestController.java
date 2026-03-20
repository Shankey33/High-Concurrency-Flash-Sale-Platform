package com.pm.loadtest.controller;

import com.pm.common.dto.TestEventDTO;
import com.pm.loadtest.service.LoadTestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/load-test")
@RequiredArgsConstructor
public class LoadTestController {

    private final LoadTestService loadTestService;

    @PostMapping("/start")
    public TestEventDTO startTest(@Valid @RequestBody TestEventDTO testEventDTO){
        return loadTestService.startTest(testEventDTO);
    }
}
