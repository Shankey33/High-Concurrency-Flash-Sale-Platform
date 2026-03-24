package com.pm.loadtest.repository;

import com.pm.common.dto.TestEventDTO;
import com.pm.loadtest.convertor.LoadTestMapper;
import com.pm.loadtest.model.Test;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LoadTestRepository extends JpaRepository<Test, String> {
}
