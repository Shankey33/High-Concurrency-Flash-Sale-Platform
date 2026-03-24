package com.pm.loadtest.service;

import com.pm.loadtest.convertor.LoadTestMapper;
import com.pm.loadtest.model.Test;
import com.pm.loadtest.repository.LoadTestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import com.pm.common.dto.TestEventDTO;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class LoadTestService {
    private final RunTestAsync runTestAsync;
    private final LoadTestRepository loadTestRepository;
    private final LoadTestMapper loadTestMapper;

    public String startTest(TestEventDTO testEventDTO){

        String testId = UUID.randomUUID().toString();
        testEventDTO.setTestId(testId);

        Test entity = loadTestMapper.toEntity(testEventDTO);
        loadTestRepository.save(entity);

        runTestAsync.runTest(testId);

        return testId;
    }


    public TestEventDTO getResult(String testId) {
        try {
            Optional<Test> test = loadTestRepository.findById(testId);

            if (test.isPresent()) {
                return loadTestMapper.toDTO(test.get());
            } else {
                log.warn("Test not found for id: {}", testId);
                return null;
            }

        } catch (Exception e) {
            log.warn("Error fetching/mapping test entity!", e);
            return null;
        }
    }

    public List<TestEventDTO> getAllTests(){

        return loadTestRepository
                .findAll()
                .stream()
                .map(loadTestMapper::toDTO)
                .toList();
    }
}
