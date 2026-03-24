package com.pm.loadtest.controller;

import com.pm.common.dto.TestEventDTO;
import com.pm.loadtest.service.LoadTestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/load-test")
@RequiredArgsConstructor
@Slf4j
public class LoadTestController {

    private final LoadTestService loadTestService;

    @PostMapping("/start")
    public String startTest(@Valid @RequestBody TestEventDTO testEventDTO){
        return loadTestService.startTest(testEventDTO);
    }

    @GetMapping("/status/{testId}")
    public ResponseEntity<TestEventDTO> getResult(@PathVariable String testId){
        TestEventDTO result = loadTestService.getResult(testId);
        return result == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(result);
    }

    @GetMapping("/get-all")
    public ResponseEntity<List<TestEventDTO>> getAll (){
        try {
            List<TestEventDTO> list = loadTestService.getAllTests();
            if (list.isEmpty()) return ResponseEntity.notFound().build();
            return ResponseEntity.ok().body(list);
        } catch (Exception e) {
            log.error("Error fetching test results from DB: " + e.getMessage());
            return ResponseEntity.noContent().build();
        }
    }

}
