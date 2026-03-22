package com.pm.inventoryservice.service;

import com.pm.common.dto.OrderEventDTO;
import com.pm.common.dto.StockSetDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import java.util.Collections;
import java.util.UUID;

@Service
@Slf4j
public class Purchase {
    private final StringRedisTemplate redisTemplate;
    private final KafkaTemplate<String, OrderEventDTO> kafkaTemplate;
    private final DefaultRedisScript<Long> redisScript;

    public Purchase(StringRedisTemplate redisTemplate,
                    KafkaTemplate<String, OrderEventDTO> kafkaTemplate) {

        this.redisTemplate = redisTemplate;
        this.kafkaTemplate = kafkaTemplate;

        this.redisScript = new DefaultRedisScript<>();
        this.redisScript.setScriptText(DECR_IF_AVAILABLE);
        this.redisScript.setResultType(Long.class);
    }

    private static final String DECR_IF_AVAILABLE =
            "local stock = tonumber(redis.call('GET', KEYS[1])) " +
                    "if stock and stock > 0 then " +
                    "   return redis.call('DECR', KEYS[1]) " +
                    "else " +
                    "   return -1 " +
                    "end";


    public boolean purchaseItem(String productId) {

        String key = "stock:" + productId;

        Long result = redisTemplate.execute(
                redisScript,
                Collections.singletonList(key)
        );

        if (result != null && result >= 0) {

            String orderId = UUID.randomUUID().toString();
            OrderEventDTO orderEventDTO = new OrderEventDTO(orderId, productId, "PENDING");

            kafkaTemplate.send("sale-orders", orderId, orderEventDTO);

            return true;
        } else {
            return false;
        }
    }

    @KafkaListener(topics = "stock-revert", groupId = "inventory-group")
    public void revertStock(String productId) {

        log.info("Revert request for stock received for product: " + productId);

        String cleanId = productId.replace("\"", "");
        String key = "stock:" + cleanId;

        redisTemplate.opsForValue().increment(key);

        log.info("Reverted stock!");
    }

    public boolean setStock(StockSetDTO dto){

        int quantity = dto.getQuantity();
        String key = "stock:" + dto.getProductId();

        if(quantity < 0){
            log.error("Stock quantity should be positive!");
            return false;
        }
        String value = String.valueOf(quantity);

        try{
            redisTemplate.opsForValue().set(key, value);
        } catch (Exception e) {
            log.error("Error occured while trying to set quantity: " + e.getMessage());
            return false;
        }

        return true;
    }
}