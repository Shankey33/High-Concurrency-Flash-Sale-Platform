package com.pm.inventoryservice.service;

import com.pm.common.dto.OrderEventDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@RequiredArgsConstructor
@Service
@Slf4j
public class Purchase {
    private final StringRedisTemplate redisTemplate;
    private final KafkaTemplate<String, OrderEventDTO> kafkaTemplate;

    public String purchaseItem(String productId){
        Long remainingStock = redisTemplate.opsForValue().decrement("stock:" + productId);

        if(remainingStock != null && remainingStock >= 0){

            String orderId = UUID.randomUUID().toString();
            OrderEventDTO orderEventDTO = new OrderEventDTO(orderId, productId, "PENDING");
            kafkaTemplate.send("sale-orders", orderId, orderEventDTO);

            return "Order Accepted! In process. Order Id: " + orderId;
        } else {
            return "Sold Out";
        }
    }

    @KafkaListener(topics = "stock-revert", groupId = "inventory-group")
    public void revertStock(String productId){

        log.info("Revert request for stock received for product: " + productId);

        String cleanId = productId.replace("\"", "");
        String key = "stock:" + cleanId;

        redisTemplate.opsForValue().increment(key);

        log.info("Reverted stock!");
    }
}
