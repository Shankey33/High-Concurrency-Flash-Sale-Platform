package com.pm.inventoryservice.controller;

import com.pm.common.dto.StockSetDTO;
import com.pm.inventoryservice.service.Purchase;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;


@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class StockController {

    private final Purchase purchase;

    @PostMapping("/buy/{productId}")
    public ResponseEntity<String> buyProduct(@PathVariable String productId){
        if(purchase.purchaseItem(productId)){
            return ResponseEntity.ok("Order Accepted");
        } else {
            return ResponseEntity.status(409).body("Sold Out");
        }
    }

    @PostMapping("/set/quantity")
    public ResponseEntity<?> setStock(@Valid @RequestBody StockSetDTO stockSetDTO){

        if(purchase.setStock(stockSetDTO)) {
            return ResponseEntity.ok().body("Stock Updated!");
        }else {
            return ResponseEntity.badRequest().body("Error Updating the Stock See logs for info!");
        }
    }
}
